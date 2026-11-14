#!/usr/bin/env python3
"""《进度条的一生》 —— 1080x1920 / 30fps 竖屏趣味短片。

画面：skia 逐帧绘制；声音：numpy/scipy 纯代码合成。所有动作和音效
都从同一条时间轴（下面的常量与函数）推导，保证声画同步。

用法:
    python3 make_video.py                 # 渲染完整 MP4
    python3 make_video.py --frames 1,15.5 # 只导出指定时间点的 PNG 用于检查
"""
import math
import os
import subprocess
import sys
import wave

import numpy as np
import skia
from scipy.signal import butter, lfilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1920
FPS = 30
SR = 48000

# ----------------------------------------------------------------- 时间轴常量
T_CLOSE = 1263 / FPS        # 42.100  弹窗"啪"地关掉
T_REPOP = 1295 / FPS        # 43.167  新弹窗弹出（≈1 秒彻底安静之后）
END = 1362 / FPS            # 45.400
NFR = 1362

T_STUCK = 14.5              # 走到 99%，旋律戛然而止
T_BUBBLE_IN, T_BUBBLE_OUT = 31.2, 34.8
T_MELODY_BACK = 36.9        # 决定往前走，旋律以更慢的速度回来
T_DONE = 41.2               # 100%

# 一蹦一跳冲向 60%： (起跳, 落地, 起点%, 终点%, 跳跃高度px)
HOPS = [(3.00, 3.80, 0, 6, 16), (3.88, 4.58, 6, 14, 22), (4.66, 5.30, 14, 24, 28),
        (5.38, 5.96, 24, 35, 36), (6.04, 6.58, 35, 47, 44), (6.66, 7.20, 47, 60, 54)]
# 95..99 一格一格越来越吃力
STEPS = [(11.40, 11.50, 94, 95), (12.00, 12.10, 95, 96), (12.65, 12.75, 96, 97),
         (13.45, 13.55, 97, 98), (14.40, 14.50, 98, 99)]

# 状态小字： (出现时间, 文本, 每字打出间隔)
STATUS = [(0.6, "正在加载…", 0.055), (5.3, "很简单嘛", 0.06), (9.4, "快了快了", 0.06),
          (15.0, "……", 0.30), (21.0, "等等", 0.08), (23.0, "到了 100%，我会怎么样", 0.055),
          (28.4, "剩余时间：约 3 年", 0.055), (32.6, "……", 0.30), (35.0, "算了", 0.10),
          (T_DONE, "加载完成", 0.035)]
BUBBLE_LINES = ["我在这儿这么久，", "从来没人点过我。"]


# ----------------------------------------------------------------- 缓动工具
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def lerp(a, b, u):
    return a + (b - a) * u


def nrm(t, t0, t1):
    return clamp((t - t0) / (t1 - t0))


def e_lin(u): return u
def e_io(u): return u * u * (3 - 2 * u)
def e_io3(u): return 4 * u ** 3 if u < .5 else 1 - (-2 * u + 2) ** 3 / 2
def e_out(u): return 1 - (1 - u) ** 2
def e_in_sine(u): return 1 - math.cos(u * math.pi / 2)
def e_out_quad(u): return 1 - (1 - u) ** 2


def e_walk(u, r=0.06):
    """匀速，两端各有一小段柔和的加/减速 —— "很慢、很稳"。"""
    v = 1 / (1 - r)
    if u < r:
        return v * u * u / (2 * r)
    if u > 1 - r:
        return 1 - v * (1 - u) ** 2 / (2 * r)
    return v * (u - r / 2)


def bump(t, t0, t1):
    if t < t0 or t > t1:
        return 0.0
    return math.sin(math.pi * (t - t0) / (t1 - t0))


def ring(t, t0, amp, freq=5.0, decay=0.10):
    """落地挤压：带阻尼的回弹。"""
    if t < t0:
        return 0.0
    d = t - t0
    return amp * math.exp(-d / decay) * math.cos(2 * math.pi * freq * d)


def keyframes(track, t):
    """track: [(time, value, ease_into_this_key)]"""
    if t <= track[0][0]:
        return track[0][1]
    for (t0, v0, _), (t1, v1, ef) in zip(track, track[1:]):
        if t <= t1:
            return lerp(v0, v1, ef((t - t0) / (t1 - t0)))
    return track[-1][1]


# ----------------------------------------------------------------- 进度（逻辑值）
SEGS = [(a, b, p0, p1, e_io3) for a, b, p0, p1, _ in HOPS]
SEGS += [(9.0, 9.9, 60, 80, e_in_sine), (9.9, 11.0, 80, 94, e_out_quad)]
SEGS += [(a, b, p0, p1, e_out) for a, b, p0, p1 in STEPS]
SEGS += [(27.3, 27.5, 99, 98, e_io), (27.9, 28.15, 98, 95, e_io),
         (28.5, 29.3, 95, 80, e_io), (29.5, T_BUBBLE_IN, 80, 50, e_in_sine),  # 被气泡吓得急停
         (37.1, 40.6, 50, 99, e_walk),
         (41.1, T_DONE, 99, 100, e_out)]
SEGS.sort()


def scene_t(t):
    """新弹窗弹出后，复用开头的时间轴（首尾一致，方便循环）。"""
    return t - T_REPOP if t >= T_REPOP else t


def progress(t):
    t = scene_t(t)
    val = 0.0
    for t0, t1, p0, p1, ef in SEGS:
        if t < t0:
            break
        if t <= t1:
            return p0 + (p1 - p0) * ef((t - t0) / (t1 - t0))
        val = p1
    return val


def strain(t):
    """用力程度 0..1：两次憋劲，中间换一口气，19.9 秒泄气。"""
    if t < 17.3 or t > 20.05:
        return 0.0
    if t < 18.4:
        return 0.62 * nrm(t, 17.3, 18.4) ** 0.7
    if t < 18.6:
        return lerp(0.62, 0.30, e_out(nrm(t, 18.4, 18.6)))
    if t < 19.9:
        return lerp(0.30, 1.0, nrm(t, 18.6, 19.9) ** 1.3)
    return 1.0 - e_out(nrm(t, 19.9, 20.05))


HEAT = [(0, 0, e_lin), (17.3, 0, e_lin), (18.4, 0.6, e_lin), (18.6, 0.52, e_lin),
        (19.9, 1.0, e_lin), (20.8, 0.0, e_io)]

# 身体的基础纵向比例（挤压/拉伸/深呼吸都在这里）
BASE_SY = [(0, 1.0, e_lin), (11.0, 1.0, e_lin), (14.5, 0.94, e_lin), (16.9, 0.94, e_lin),
           (17.3, 1.04, e_io), (19.9, 1.04, e_lin), (20.4, 0.82, e_out),       # 泄气
           (21.0, 0.82, e_lin), (21.15, 1.0, e_out),                            # "等等"
           (23.0, 1.0, e_lin), (24.0, 0.93, e_io),                              # 想事情
           (27.0, 0.93, e_lin), (27.3, 0.80, e_io),                             # 压低身子偷偷往回
           (31.2, 0.80, e_lin), (31.27, 1.12, e_out), (31.55, 1.0, e_io),       # 被吓一跳
           (32.6, 1.0, e_lin), (33.4, 0.95, e_io),
           (35.4, 0.95, e_lin), (36.4, 1.38, e_io), (36.6, 1.38, e_lin),        # 深吸一口气
           (37.0, 1.0, e_io), (T_DONE, 1.0, e_lin), (41.35, 1.12, e_out), (41.6, 1.05, e_io)]
BASE_DY = [(0, 0, e_lin), (35.4, 0, e_lin), (36.4, -6, e_io), (36.6, -6, e_lin), (37.0, 0, e_io)]
GATHER = [(0, 0, e_lin), (16.9, 0, e_lin), (17.3, -0.6, e_io), (17.45, 0, e_out)]
LEAN = [(0, 0, e_lin), (24.4, 0, e_lin), (25.6, 2.1, e_io), (26.4, 2.1, e_lin), (26.9, 0, e_io)]


def frame_noise(t, salt):
    i = int(round(t * FPS)) * 7919 + salt * 104729
    return (math.sin(i * 12.9898) * 43758.5453) % 1.0 * 2 - 1


def body(t):
    """进度条此刻的情绪动作。"""
    st = scene_t(t)
    sy = keyframes(BASE_SY, st)
    dy = keyframes(BASE_DY, st)
    pext = keyframes(GATHER, st)
    if st < 3.0:  # 开头的轻微呼吸
        sy += 0.015 * math.sin(2 * math.pi * 0.6 * st) * nrm(st, 0.4, 1.0)
    # 一蹦一跳
    for i, (t0, t1, p0, p1, hh) in enumerate(HOPS):
        sy -= 0.16 * bump(st, t0 - 0.12, t0 + 0.02)
        if t0 <= st <= t1:
            u = (st - t0) / (t1 - t0)
            dy -= hh * math.sin(math.pi * u)
            sy += 0.10 * math.sin(math.pi * u)
        sy -= ring(st, t1, 0.16 + 0.02 * i, 5.5, 0.09)
    # 到 60% 得意地原地一大跳，然后晃两下
    sy -= 0.22 * bump(st, 7.25, 7.5)
    if 7.45 <= st <= 8.15:
        u = nrm(st, 7.45, 8.15)
        dy -= 72 * math.sin(math.pi * u)
        sy += 0.16 * math.sin(math.pi * u)
    sy -= ring(st, 8.15, 0.26, 4.5, 0.12)
    if 8.4 <= st < 9.0:
        sy += 0.035 * math.sin(2 * math.pi * 2.5 * (st - 8.4))
    sy -= 0.07 * bump(st, 9.1, 10.8)  # 跑得快，身子被拉长
    # 95..99 每一格：先缩、蓄力，再往前一挪，落地后更疲惫
    for k, (t0, t1, p0, p1) in enumerate(STEPS):
        pext -= 0.5 * bump(st, t0 - 0.25, t0)
        sy += (0.07 + 0.015 * k) * bump(st, t0 - 0.25, t0)
        sy -= ring(st, t1, 0.10 + 0.02 * k, 6.0, 0.07)
    # 用力挤
    s = strain(st)
    pext += 0.55 * s
    sy += 0.18 * s
    sy += ring(st, 19.9, 0.06, 4.0, 0.15) if st >= 19.9 else 0.0
    shake = 9.0 * s ** 1.2
    shx = shake * frame_noise(st, 1)
    shy = shake * 0.6 * frame_noise(st, 2)
    # "等等"——灵光一闪，轻轻一弹
    dy -= 10 * bump(st, 21.0, 21.25)
    # 偷偷往回缩时小心翼翼地左右挪
    if 27.3 <= st < T_BUBBLE_IN:
        sy += 0.02 * math.sin(2 * math.pi * 1.6 * (st - 27.3))
    # 被"取消"按钮吓一跳
    dy -= 16 * bump(st, T_BUBBLE_IN, T_BUBBLE_IN + 0.22)
    # 稳稳地往前走：均匀的小步子
    if 37.1 <= st <= 40.6:
        w = nrm(st, 37.1, 37.4) * (1 - nrm(st, 40.3, 40.6))
        dy -= 4 * abs(math.sin(2 * math.pi * 1.5 * (st - 37.1))) * w
        sy += 0.02 * math.sin(2 * math.pi * 3 * (st - 37.1)) * w
    heat = keyframes(HEAT, st)
    done = e_out(nrm(st, T_DONE, T_DONE + 0.12)) if st < T_CLOSE else 0.0
    return dict(sy=sy, dy=dy, pext=pext, shx=shx, shy=shy, heat=heat, done=done,
                lean=keyframes(LEAN, st), shine=nrm(st, T_DONE + 0.05, T_DONE + 0.55))


def status_at(t):
    st = scene_t(t)
    cur = None
    for ts, txt, cps in STATUS:
        if st >= ts:
            cur = (ts, txt, cps)
    if cur is None:
        return "", "", 0
    ts, txt, cps = cur
    n = min(len(txt), int((st - ts) / cps) + 1)
    return txt, txt[:n], n


def typing_times():
    out = []
    for base in (0.0, T_REPOP):
        for ts, txt, cps in STATUS:
            for k, ch in enumerate(txt):
                tt_ = base + ts + k * cps
                if ch != " " and tt_ < END and (base == 0.0 and tt_ < T_CLOSE or base > 0):
                    out.append(tt_)
    return out


# ----------------------------------------------------------------- 画面
def C(hexs, a=255):
    hexs = hexs.lstrip("#")
    return skia.Color(int(hexs[0:2], 16), int(hexs[2:4], 16), int(hexs[4:6], 16), a)


def mix(c1, c2, u):
    return tuple(lerp(a, b, u) for a, b in zip(c1, c2))


BLUE, ORANGE, RED, GREEN = (59, 130, 246), (245, 140, 20), (232, 64, 64), (34, 190, 94)
TF_CJK = skia.Typeface("Noto Sans CJK SC", skia.FontStyle.Normal())
TF_CJK_B = skia.Typeface("Noto Sans CJK SC", skia.FontStyle.Bold())
TF_NUM = skia.Typeface("Inter", skia.FontStyle.Bold())
F_TITLE = skia.Font(TF_CJK, 40)
F_NUM = skia.Font(TF_NUM, 150)
F_STATUS = skia.Font(TF_CJK, 58)
F_BTN = skia.Font(TF_CJK, 46)
F_BUB = skia.Font(TF_CJK, 50)
for f in (F_TITLE, F_NUM, F_STATUS, F_BTN, F_BUB):
    f.setSubpixel(True)
    f.setEdging(skia.Font.Edging.kAntiAlias)

# 弹窗几何（全局坐标）
DX, DY, DW, DH = 80, 560, 920, 720
CX, CY = DX + DW / 2, DY + DH / 2
TRK_X0, TRK_X1, TRK_CY, TRK_H = DX + 70, DX + DW - 70, DY + 400, 104
FILL_H = 84
NUM_Y = DY + 280
STATUS_Y = DY + 530
BTN = (DX + 650, DY + 590, DX + 870, DY + 686)


def P(color, a=255, aa=True):
    p = skia.Paint(AntiAlias=aa)
    p.setColor(skia.Color(int(color[0]), int(color[1]), int(color[2]), int(a)))
    return p


def rrect(x0, y0, x1, y1, r):
    return skia.RRect.MakeRectXY(skia.Rect.MakeLTRB(x0, y0, x1, y1), r, r)


def text_w(font, s):
    return font.measureText(s)


def draw_bg(c):
    p = skia.Paint()
    p.setShader(skia.GradientShader.MakeLinear(
        [skia.Point(0, 0), skia.Point(0, H)], [C("#F5F7FA"), C("#E8ECF1")]))
    c.drawRect(skia.Rect.MakeWH(W, H), p)


def draw_dialog(c, t):
    b = body(t)
    st = scene_t(t)
    pnum = progress(t)
    shown = int(round(pnum))

    # 标题栏 + 弹窗本体
    sh = skia.Paint(AntiAlias=True, Color=skia.Color(30, 40, 60, 46))
    sh.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 34))
    c.drawRRect(rrect(DX, DY + 24, DX + DW, DY + DH + 24, 40), sh)
    c.drawRRect(rrect(DX, DY, DX + DW, DY + DH, 40), P((255, 255, 255)))
    c.drawRRect(rrect(DX + 52, DY + 38, DX + 82, DY + 68, 8), P(BLUE))
    c.drawString("进度条的一生", DX + 100, DY + 68, F_TITLE, P((107, 114, 128)))
    c.drawRect(skia.Rect.MakeLTRB(DX, DY + 108, DX + DW, DY + 110), P((236, 239, 243)))

    # ---- 会"看向"取消按钮的内容组
    c.save()
    piv = (CX, TRK_CY)
    c.translate(piv[0] + 5 * b["lean"], piv[1] + 2 * b["lean"])
    c.rotate(b["lean"])
    c.translate(-piv[0], -piv[1])

    heat, done = b["heat"], b["done"]
    col = mix(BLUE, ORANGE, clamp(heat * 2)) if heat < 0.5 else mix(ORANGE, RED, clamp(heat * 2 - 1))
    col = mix(col, GREEN, done)

    # 百分比数字
    ns = f"{shown}%"
    nw = text_w(F_NUM, ns)
    numcol = mix((17, 24, 39), (22, 163, 74), done)
    c.drawString(ns, CX - nw / 2 + 0.5 * b["shx"], NUM_Y + 0.35 * b["dy"] + 0.5 * b["shy"], F_NUM, P(numcol))

    # 轨道
    c.save()
    c.translate(b["shx"] * 0.5, b["shy"] * 0.5)
    c.drawRRect(rrect(TRK_X0, TRK_CY - TRK_H / 2, TRK_X1, TRK_CY + TRK_H / 2, TRK_H / 2), P((229, 233, 239)))
    c.restore()

    # 主角：填充条
    fh = FILL_H * b["sy"]
    inner0, inner1 = TRK_X0 + 10, TRK_X1 - 10
    pvis = clamp(pnum + b["pext"], 0, 100.6) / 100.0
    fw = FILL_H + (inner1 - inner0 - FILL_H) * pvis
    fx0 = inner0 + b["shx"]
    fcy = TRK_CY + b["dy"] + b["shy"]
    rr = rrect(fx0, fcy - fh / 2, fx0 + fw, fcy + fh / 2, min(fh, fw) / 2)
    if done > 0:
        g = skia.Paint(AntiAlias=True)
        g.setColor(skia.Color(*[int(v) for v in GREEN], int(150 * done)))
        g.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 26))
        c.drawRRect(rrect(fx0 - 10, fcy - fh / 2 - 10, fx0 + fw + 10, fcy + fh / 2 + 10, fh / 2 + 10), g)
    light = mix(col, (255, 255, 255), 0.28 + 0.25 * done)
    fp = skia.Paint(AntiAlias=True)
    fp.setShader(skia.GradientShader.MakeLinear(
        [skia.Point(0, fcy - fh / 2), skia.Point(0, fcy + fh / 2)],
        [skia.Color(*[int(v) for v in light]), skia.Color(*[int(v) for v in col])]))
    c.drawRRect(rr, fp)
    if 0 < b["shine"] < 1:
        c.save()
        c.clipRRect(rr, doAntiAlias=True)
        sx = lerp(fx0 - 200, fx0 + fw + 200, e_io(b["shine"]))
        sp = skia.Paint(AntiAlias=True)
        sp.setShader(skia.GradientShader.MakeLinear(
            [skia.Point(sx - 120, 0), skia.Point(sx + 120, 0)],
            [skia.Color(255, 255, 255, 0), skia.Color(255, 255, 255, 170), skia.Color(255, 255, 255, 0)],
            [0.0, 0.5, 1.0]))
        c.drawRect(skia.Rect.MakeLTRB(sx - 130, fcy - fh, sx + 130, fcy + fh), sp)
        c.restore()

    # 状态小字（它唯一的"嘴"）
    full, part, _ = status_at(t)
    if part:
        fwid = text_w(F_STATUS, full)
        x = CX - fwid / 2
        for ch in part:  # 中文省略号居中显示，而不是贴着基线
            c.drawString(ch, x, STATUS_Y - (17 if ch == "…" else 0), F_STATUS, P((55, 65, 81)))
            x += text_w(F_STATUS, ch)
    c.restore()

    # 取消按钮
    bx0, by0, bx1, by1 = BTN
    pulse = 1 + 0.06 * bump(st, T_BUBBLE_IN, T_BUBBLE_IN + 0.25) + 0.03 * bump(st, T_BUBBLE_IN + 0.3, T_BUBBLE_IN + 0.5)
    c.save()
    bcx, bcy = (bx0 + bx1) / 2, (by0 + by1) / 2
    c.translate(bcx, bcy)
    c.scale(pulse, pulse)
    c.translate(-bcx, -bcy)
    c.drawRRect(rrect(bx0, by0, bx1, by1, 22), P((246, 247, 249)))
    bp = P((209, 213, 219))
    bp.setStyle(skia.Paint.kStroke_Style)
    bp.setStrokeWidth(3)
    c.drawRRect(rrect(bx0 + 1.5, by0 + 1.5, bx1 - 1.5, by1 - 1.5, 21), bp)
    tw = text_w(F_BTN, "取消")
    c.drawString("取消", bcx - tw / 2, bcy + 16, F_BTN, P((55, 65, 81)))
    c.restore()


def draw_bubble(c, t):
    if not (T_BUBBLE_IN <= t < T_BUBBLE_OUT + 0.15):
        return
    if t < T_BUBBLE_OUT:
        d = t - T_BUBBLE_IN
        s = 1 - math.exp(-d / 0.07) * math.cos(2 * math.pi * 2.6 * d)
        a = 1.0
    else:
        u = nrm(t, T_BUBBLE_OUT, T_BUBBLE_OUT + 0.15)
        s, a = 1 - 0.3 * u, 1 - u
    tipx, tipy = (BTN[0] + BTN[2]) / 2, DY + DH + 14
    x0, x1, y0 = DX + DW - 500, DX + DW, DY + DH + 44
    lh = 74
    y1 = y0 + 40 * 2 + lh * len(BUBBLE_LINES) - 14
    c.save()
    c.translate(tipx, tipy)
    c.scale(s, s)
    c.translate(-tipx, -tipy)
    c.saveLayerAlpha(None, int(255 * a))
    sh = skia.Paint(AntiAlias=True, Color=skia.Color(30, 40, 60, 40))
    sh.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, 18))
    c.drawRRect(rrect(x0, y0 + 10, x1, y1 + 10, 30), sh)
    path = skia.Path()
    path.addRRect(rrect(x0, y0, x1, y1, 30))
    tail = skia.Path()
    tail.moveTo(tipx - 26, y0 + 2)
    tail.lineTo(tipx, tipy)
    tail.lineTo(tipx + 26, y0 + 2)
    tail.close()
    path = skia.Op(path, tail, skia.PathOp.kUnion_PathOp)
    c.drawPath(path, P((255, 255, 255)))
    op = P((209, 213, 219))
    op.setStyle(skia.Paint.kStroke_Style)
    op.setStrokeWidth(3)
    c.drawPath(path, op)
    for i, line in enumerate(BUBBLE_LINES):
        c.drawString(line, x0 + 50, y0 + 40 + 50 + i * lh, F_BUB, P((75, 85, 99)))
    c.restore()
    c.restore()


def dialog_transform(t):
    """返回 (可见, 缩放, 透明度)。"""
    if T_CLOSE + 1 / FPS <= t < T_REPOP:
        return False, 0, 0
    if T_CLOSE <= t < T_CLOSE + 1 / FPS:   # "啪"——只剩一帧残影
        return True, 0.965, 0.35
    d = scene_t(t)
    if d < 0.8:
        s = 1 - 0.45 * math.exp(-d / 0.12) * math.cos(2 * math.pi * 2.0 * d)
        return True, s, clamp(d / 0.08 + 0.25)
    return True, 1.0, 1.0


def render(c, t):
    draw_bg(c)
    vis, s, a = dialog_transform(t)
    if vis:
        c.save()
        c.translate(CX, CY)
        c.scale(s, s)
        c.translate(-CX, -CY)
        if a < 1:
            c.saveLayerAlpha(None, int(255 * a))
        draw_dialog(c, t)
        if a < 1:
            c.restore()
        c.restore()
    draw_bubble(c, t)


# ----------------------------------------------------------------- 声音
NS = int(round(END * SR))
RNG = np.random.default_rng(7)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env(t, tau, att=0.002):
    return np.minimum(1.0, t / att) * np.exp(-t / tau)


def add(buf, t0, sig, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 >= len(buf):
        return
    i1 = min(len(buf), i0 + len(sig))
    buf[i0:i1] += gain * sig[: i1 - i0]


def bp(x, lo, hi):
    b, a = butter(2, [lo / (SR / 2), hi / (SR / 2)], btype="band")
    return lfilter(b, a, x)


def lp(x, fc):
    b, a = butter(2, fc / (SR / 2))
    return lfilter(b, a, x)


def snd_ding():
    t = tt(0.7)
    f = 1568.0
    s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.06)
         + 0.12 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t / 0.03))
    return 0.16 * s * env(t, 0.17, 0.002)


def snd_tick(p, down=False, heavy=False):
    t = tt(0.06)
    f0 = 780 * 2 ** (p / 105)
    f = f0 * (np.exp(-t * 9) * 0.35 + 0.65) if down else np.full_like(t, f0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + 0.25 * np.sin(2 * ph)) * env(t, 0.022 if down else (0.016 if heavy else 0.009), 0.0006)
    click = bp(RNG.standard_normal(len(t)), 2500, 7000) * np.exp(-t / 0.0012) * 0.25
    out = (0.13 if down else 0.21) * (s + click)
    if heavy:
        th = np.sin(2 * np.pi * 150 * t * (1 - t * 3)) * env(t, 0.025, 0.002)
        out = 1.45 * out + 0.12 * th
    return out


def snd_type():
    t = tt(0.035)
    n = bp(RNG.standard_normal(len(t)), 1800, 6000) * env(t, 0.0045, 0.0005)
    k = np.sin(2 * np.pi * RNG.uniform(2600, 3200) * t) * env(t, 0.003, 0.0003)
    return 0.07 * (n + 0.5 * k)


def snd_thump(a=0.11):
    t = tt(0.12)
    f = 130 * np.exp(-t * 6)
    return a * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.04, 0.003)


def snd_hum():
    """用力挤：低沉嗡嗡，越挤越紧、带颤抖。整个包络由 strain() 驱动。"""
    t0, t1 = 17.2, 20.1
    t = t0 + tt(t1 - t0)
    s = np.array([strain(x) for x in t])
    f = (68 + 26 * s) * (1 + 0.018 * s * np.sin(2 * np.pi * 13.0 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    wav = np.zeros_like(t)
    for k in range(1, 13):
        wav += np.sin(k * ph) / k / (1 + (k * 80 / 420) ** 2)
    trem_rate = 8 + 9 * s
    trem = 1 - (0.2 + 0.35 * s) * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(trem_rate) / SR))
    grit = lp(RNG.standard_normal(len(t)), 300) * 0.25 * s
    amp = 0.08 + 0.42 * s
    amp *= np.clip((t - 17.3) / 0.12, 0, 1)
    return t0, (wav * trem + grit) * amp * np.clip(s * 8, 0, 1) * 0.36


def snd_deflate():
    t = tt(0.55)
    n = bp(RNG.standard_normal(len(t)), 400, 1800) * np.sin(np.pi * np.clip(t / 0.5, 0, 1)) ** 0.7
    f = 260 * np.exp(-t * 2.4)
    sl = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.25, 0.01)
    return 0.09 * n + 0.10 * sl


def snd_blip(f0=900, f1=1350, a=0.08):
    t = tt(0.12)
    f = np.linspace(f0, f1, len(t))
    return a * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(t, 0.03, 0.003)


def snd_cancel():
    """"取消"按钮说话：更低、更闷，和进度条的明亮嗒嗒完全不同。"""
    out = np.zeros(int(0.65 * SR))
    for dt, f, dur in ((0.0, 233.1, 0.2), (0.2, 174.6, 0.42)):
        t = tt(dur)
        ph = 2 * np.pi * f * t
        s = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
        e = np.minimum(1, t / 0.015) * np.exp(-t / (0.09 if dur < 0.3 else 0.16))
        add(out, dt, s * e)
    return 0.21 * lp(out, 700)


def snd_breath(dur, a):
    t = tt(dur)
    n = bp(RNG.standard_normal(len(t)), 500, 2400)
    return a * n * np.sin(np.pi * t / dur) ** 1.5


def snd_chime():
    out = np.zeros(int(2.5 * SR))
    for i, f in enumerate((1046.5, 1318.5, 1568.0, 2093.0)):
        t = tt(1.8)
        s = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.2)
             + 0.08 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t / 0.08))
        add(out, i * 0.065, 0.08 * s * env(t, 0.55, 0.002))
    wet = np.zeros_like(out)
    for d, g in ((0.071, 0.35), (0.113, 0.28), (0.167, 0.2), (0.241, 0.14)):  # 小小的余韵
        add(wet, d, out, g)
    return out + lp(wet, 5000)


def snd_pa():
    t = tt(0.035)
    n = bp(RNG.standard_normal(len(t)), 900, 9000) * np.exp(-t / 0.0035)
    k = np.sin(2 * np.pi * 170 * t) * np.exp(-t / 0.008)
    s = 0.26 * n + 0.22 * k
    s[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    return s


PAT = [329.63, 392.0, 523.25, 392.0, 440.0, 392.0, 329.63, 293.66]


def snd_note(f, dur=0.22):
    t = tt(dur + 0.12)
    ph = 2 * np.pi * f * t
    s = np.sin(ph) + 0.33 * np.sin(3 * ph) / 1.0 * 0.5 + 0.2 * np.sin(5 * ph) * 0.3
    e = np.minimum(1, t / 0.004) * np.exp(-t / 0.11)
    return s * e


def gate(t, windows, ramp=0.004):
    g = np.zeros_like(t)
    for a, b in windows:
        g = np.maximum(g, np.clip((t - a) / ramp + 1, 0, 1) * np.clip((b - t) / ramp, 0, 1))
    return g


def tick_events():
    """从进度函数本身推出每一格的时间，保证"嗒"和数字变化同帧。"""
    ts = np.arange(0, END, 0.001)
    prev = int(round(progress(0)))
    ev = []
    for t in ts:
        v = int(round(progress(t)))
        if T_CLOSE <= t < T_REPOP + 0.01:   # 弹窗被关掉/重置，不算"走格子"
            prev = v
            continue
        if v != prev:
            for k in range(abs(v - prev)):
                vv = prev + (k + 1) * (1 if v > prev else -1)
                ev.append((t, vv, v < prev))
            prev = v
    return ev


def build_audio():
    fx = np.zeros(NS)
    mus = np.zeros(NS)
    T = np.arange(NS) / SR

    for t0 in (0.0, T_REPOP):
        add(fx, t0, snd_ding())
    for t in typing_times():
        add(fx, t, snd_type())
    for t, v, down in tick_events():
        heavy = (not down) and 95 <= v <= 99 and t < 15
        add(fx, t, snd_tick(v, down=down, heavy=heavy))
    for i, (_, t1, *_r) in enumerate(HOPS):
        add(fx, t1, snd_thump(0.065 + 0.015 * i))
    add(fx, 8.15, snd_thump(0.14))
    t0, hum = snd_hum()
    add(fx, t0, hum)
    add(fx, 19.92, snd_deflate())
    add(fx, 21.0, snd_blip())
    add(fx, T_BUBBLE_IN, snd_cancel())
    add(fx, 35.4, snd_breath(1.05, 0.07))   # 吸气
    add(fx, 36.6, snd_breath(0.45, 0.05))  # 呼气
    add(fx, T_DONE, snd_chime())

    # 背景小旋律
    def melody(start, stop, base_iv, speedup):
        t = start
        i = 0
        while t < stop:
            add(mus, t, snd_note(PAT[i % len(PAT)]))
            r = 1 + speedup * clamp(progress(t) / 99) if speedup else 1
            t += base_iv / r
            i += 1
    melody(0.3, T_STUCK, 0.25, 0.45)
    melody(T_MELODY_BACK, T_CLOSE, 0.36, 0)
    melody(T_REPOP + 0.3, END, 0.25, 0.45)
    mus = lp(mus, 3200) * 0.075
    mus *= gate(T, [(0, T_STUCK), (T_MELODY_BACK - 0.01, T_CLOSE), (T_REPOP, END + 1)])

    # 弹窗关掉的瞬间：一切声音被掐断，然后彻底安静
    fx *= gate(T, [(-1, T_CLOSE), (T_REPOP - 0.002, END + 1)], ramp=0.003)
    add(fx, T_CLOSE, snd_pa())

    mix_ = fx + mus
    peak = np.max(np.abs(mix_))
    mix_ = np.tanh(mix_ / peak * 1.2) / math.tanh(1.2) * 0.79  # 柔和限幅，留出 AAC 余量
    return mix_, fx, mus


def write_wav(path, x):
    x16 = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    st = np.stack([x16, x16], axis=1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(st.tobytes())


# ----------------------------------------------------------------- 主流程
def main():
    if len(sys.argv) > 2 and sys.argv[1] == "--frames":
        os.makedirs(os.path.join(HERE, "check"), exist_ok=True)
        for s in sys.argv[2].split(","):
            t = float(s)
            arr = np.zeros((H, W, 4), np.uint8)
            surf = skia.Surface(arr)
            render(surf.getCanvas(), t)
            surf.makeImageSnapshot().save(os.path.join(HERE, "check", f"f_{t:06.2f}.png"))
        return

    build = os.path.join(HERE, "build")
    os.makedirs(build, exist_ok=True)
    wav = os.path.join(build, "audio.wav")
    audio, _, _ = build_audio()
    write_wav(wav, audio)
    print("audio written", len(audio) / SR, "s")

    out = os.path.join(HERE, "进度条的一生.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", wav,
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    arr = np.zeros((H, W, 4), np.uint8)
    surf = skia.Surface(arr)
    canvas = surf.getCanvas()
    for i in range(NFR):
        render(canvas, i / FPS)
        proc.stdin.write(arr.tobytes())
        if i % 150 == 0:
            print("frame", i, "/", NFR, flush=True)
    proc.stdin.close()
    proc.wait()
    print("done ->", out)


if __name__ == "__main__":
    main()
