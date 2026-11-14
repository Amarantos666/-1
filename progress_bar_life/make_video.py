#!/usr/bin/env python3
"""《进度条的一生》 —— 1080x1920 / 30fps 竖屏趣味短片。

画面：skia 逐帧绘制；声音：numpy/scipy 纯代码合成。所有动作和音效
都从同一条时间轴（下面的常量与函数）推导，保证声画同步。

无缝循环：视频从新弹窗弹出的第一帧开始，到下一个弹窗弹出的前一帧结束；
接缝落在"弹窗被关掉之后、彻底安静的那一秒空桌面"里，画面和声音都是静止/无声，
循环播放时看不出断点。

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
T_CLOSE = 1263 / FPS        # 42.100  鼠标松开 → 弹窗"啪"地关掉
NFR = 1295                  # 43.167  正好是下一个弹窗弹出的时刻 → 回到第 0 帧
END = NFR / FPS

T_STUCK = 14.5              # 走到 99%，旋律戛然而止
T_BUBBLE_IN, T_BUBBLE_OUT = 31.2, 34.8
T_MELODY_BACK = 36.9        # 决定往前走，旋律以更慢的速度回来
T_DONE = 41.2               # 100%
# 鼠标：亮起来之后滑过来，按下"取消"
T_CUR_IN, T_CUR_ARRIVE, T_CUR_DOWN = 41.32, 41.82, 41.98
T_CUR_LEAVE0, T_CUR_LEAVE1 = 42.45, 42.95

# 一蹦一跳冲向 60%： (起跳, 落地, 起点%, 终点%, 跳跃高度px)
HOPS = [(3.00, 3.80, 0, 6, 14), (3.88, 4.58, 6, 14, 20), (4.66, 5.30, 14, 24, 26),
        (5.38, 5.96, 24, 35, 33), (6.04, 6.58, 35, 47, 40), (6.66, 7.20, 47, 60, 48)]
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
def e_out3(u): return 1 - (1 - u) ** 3
def e_in3(u): return u ** 3
def e_in_sine(u): return 1 - math.cos(u * math.pi / 2)


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
SEGS += [(9.0, 9.9, 60, 80, e_in_sine), (9.9, 11.0, 80, 94, e_out)]
SEGS += [(a, b, p0, p1, e_out) for a, b, p0, p1 in STEPS]
SEGS += [(27.3, 27.5, 99, 98, e_io), (27.9, 28.15, 98, 95, e_io),
         (28.5, 29.3, 95, 80, e_io), (29.5, T_BUBBLE_IN, 80, 50, e_in_sine),  # 被气泡吓得急停
         (37.1, 40.6, 50, 99, e_walk),
         (41.1, T_DONE, 99, 100, e_out)]
SEGS.sort()


def progress(t):
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
        (19.9, 1.0, e_lin), (20.25, 1.0, e_lin), (21.0, 0.0, e_io)]
DRAIN = [(0, 0, e_lin), (19.9, 0, e_lin), (20.3, 1, e_out), (21.0, 1, e_lin), (21.6, 0, e_io)]

# 身体的基础纵向比例（挤压/拉伸/深呼吸都在这里）
BASE_SY = [(0, 1.0, e_lin), (11.0, 1.0, e_lin), (14.5, 0.94, e_lin), (16.9, 0.94, e_lin),
           (17.3, 1.04, e_io), (19.9, 1.04, e_lin), (20.4, 0.80, e_out),       # 泄气
           (21.0, 0.80, e_lin), (21.15, 1.0, e_out),                            # "等等"
           (23.0, 1.0, e_lin), (24.0, 0.93, e_io),                              # 想事情
           (27.0, 0.93, e_lin), (27.3, 0.80, e_io),                             # 压低身子偷偷往回
           (31.2, 0.80, e_lin), (31.27, 1.12, e_out), (31.55, 1.0, e_io),       # 被吓一跳
           (32.6, 1.0, e_lin), (33.4, 0.95, e_io),
           (35.4, 0.95, e_lin), (36.4, 1.34, e_io), (36.6, 1.34, e_lin),        # 深吸一口气
           (37.0, 1.0, e_io), (T_DONE, 1.0, e_lin), (41.35, 1.10, e_out), (41.6, 1.04, e_io)]
BASE_DY = [(0, 0, e_lin), (35.4, 0, e_lin), (36.4, -6, e_io), (36.6, -6, e_lin), (37.0, 0, e_io)]
GATHER = [(0, 0, e_lin), (16.9, 0, e_lin), (17.3, -0.6, e_io), (17.45, 0, e_out)]
LEAN = [(0, 0, e_lin), (24.4, 0, e_lin), (25.6, 2.0, e_io), (26.4, 2.0, e_lin), (26.9, 0, e_io)]


def frame_noise(t, salt):
    i = int(round(t * FPS)) * 7919 + salt * 104729
    return (math.sin(i * 12.9898) * 43758.5453) % 1.0 * 2 - 1


def body(t):
    """进度条此刻的情绪动作。"""
    sy = keyframes(BASE_SY, t)
    dy = keyframes(BASE_DY, t)
    pext = keyframes(GATHER, t)
    if t < 3.0:  # 开头的轻微呼吸
        sy += 0.015 * math.sin(2 * math.pi * 0.6 * t) * nrm(t, 0.4, 1.0)
    # 一蹦一跳
    for i, (t0, t1, p0, p1, hh) in enumerate(HOPS):
        sy -= 0.16 * bump(t, t0 - 0.12, t0 + 0.02)
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0)
            dy -= hh * math.sin(math.pi * u)
            sy += 0.10 * math.sin(math.pi * u)
        sy -= ring(t, t1, 0.16 + 0.02 * i, 5.5, 0.09)
    # 到 60% 得意地原地一大跳，然后晃两下
    sy -= 0.22 * bump(t, 7.25, 7.5)
    if 7.45 <= t <= 8.15:
        u = nrm(t, 7.45, 8.15)
        dy -= 62 * math.sin(math.pi * u)
        sy += 0.16 * math.sin(math.pi * u)
    sy -= ring(t, 8.15, 0.26, 4.5, 0.12)
    if 8.4 <= t < 9.0:
        sy += 0.035 * math.sin(2 * math.pi * 2.5 * (t - 8.4))
    sy -= 0.07 * bump(t, 9.1, 10.8)  # 跑得快，身子被拉长
    # 95..99 每一格：先缩、蓄力，再往前一挪，落地后更疲惫
    for k, (t0, t1, p0, p1) in enumerate(STEPS):
        pext -= 0.5 * bump(t, t0 - 0.25, t0)
        sy += (0.07 + 0.015 * k) * bump(t, t0 - 0.25, t0)
        sy -= ring(t, t1, 0.10 + 0.02 * k, 6.0, 0.07)
    # 用力挤：顶到尽头，鼻尖被压扁，身子鼓起来
    s = strain(t)
    pext += 0.62 * s
    sy += 0.18 * s
    sy += ring(t, 19.9, 0.06, 4.0, 0.15) if t >= 19.9 else 0.0
    shake = 8.0 * s ** 1.2
    shx = shake * frame_noise(t, 1)
    shy = shake * 0.6 * frame_noise(t, 2)
    # "等等"——灵光一闪，轻轻一弹
    dy -= 10 * bump(t, 21.0, 21.25)
    # 偷偷往回缩时小心翼翼
    if 27.3 <= t < T_BUBBLE_IN:
        sy += 0.02 * math.sin(2 * math.pi * 1.6 * (t - 27.3))
    # 被"取消"按钮吓一跳
    dy -= 16 * bump(t, T_BUBBLE_IN, T_BUBBLE_IN + 0.22)
    # 稳稳地往前走：均匀的小步子
    if 37.1 <= t <= 40.6:
        w = nrm(t, 37.1, 37.4) * (1 - nrm(t, 40.3, 40.6))
        dy -= 4 * abs(math.sin(2 * math.pi * 1.5 * (t - 37.1))) * w
        sy += 0.02 * math.sin(2 * math.pi * 3 * (t - 37.1)) * w
    done = e_out(nrm(t, T_DONE, T_DONE + 0.14))
    return dict(sy=sy, dy=dy, pext=pext, shx=shx, shy=shy, press=s,
                heat=keyframes(HEAT, t), drain=keyframes(DRAIN, t), done=done,
                lean=keyframes(LEAN, t), shine=nrm(t, T_DONE + 0.04, T_DONE + 0.6))


def status_at(t):
    cur = None
    for ts, txt, cps in STATUS:
        if t >= ts:
            cur = (ts, txt, cps)
    return cur


def typing_times():
    out = []
    for ts, txt, cps in STATUS:
        for k, ch in enumerate(txt):
            t = ts + k * cps
            if ch != " " and t < T_CLOSE:
                out.append(t)
    return out


# ----------------------------------------------------------------- 鼠标
CUR_START = (1170.0, 1700.0)
CUR_CTRL = (1060.0, 1290.0)


def cursor(t):
    """返回 (x, y, 按下程度) 或 None。坐标是箭头尖端。"""
    tgt = ((BTN[0] + BTN[2]) / 2 + 6, (BTN[1] + BTN[3]) / 2 + 16)
    if t < T_CUR_IN or t >= T_CUR_LEAVE1:
        return None
    if t < T_CUR_ARRIVE:
        u = e_out3(nrm(t, T_CUR_IN, T_CUR_ARRIVE))
        x = (1 - u) ** 2 * CUR_START[0] + 2 * (1 - u) * u * CUR_CTRL[0] + u * u * tgt[0]
        y = (1 - u) ** 2 * CUR_START[1] + 2 * (1 - u) * u * CUR_CTRL[1] + u * u * tgt[1]
        return x, y, 0.0
    if t < T_CUR_LEAVE0:
        down = 1.0 if T_CUR_DOWN <= t < T_CLOSE else 0.0
        return tgt[0], tgt[1], down
    u = e_in3(nrm(t, T_CUR_LEAVE0, T_CUR_LEAVE1))
    return lerp(tgt[0], 1190, u), lerp(tgt[1], 1560, u), 0.0


# ----------------------------------------------------------------- 视觉设计
def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(c1, c2, u):
    return tuple(lerp(a, b, u) for a, b in zip(c1, c2))


def col(c, a=255):
    return skia.Color(int(round(c[0])), int(round(c[1])), int(round(c[2])), int(round(a)))


# 条体配色（上，下）——一块有光泽的"果冻"
BODY_BLUE = (rgb("#7FA6FF"), rgb("#3D63F2"))
BODY_HOT = (rgb("#FFB36B"), rgb("#F07418"))
BODY_RED = (rgb("#FF7C6E"), rgb("#DD3B2C"))
BODY_DRAIN = (rgb("#B9C0CF"), rgb("#8C95A8"))
BODY_DONE = (rgb("#74E8A6"), rgb("#17B45B"))
INK = rgb("#16181D")
INK_SOFT = rgb("#3B4049")
INK_MUTED = rgb("#8D939D")
DONE_INK = rgb("#13A453")


def weight_tf(w):
    return skia.Typeface("Noto Sans CJK SC", skia.FontStyle(w, 5, skia.FontStyle.kUpright_Slant))


TF_CJK_R = weight_tf(400)
TF_CJK_M = weight_tf(500)
TF_NUM = skia.Typeface.MakeFromFile("/usr/share/fonts/opentype/inter/InterDisplay-Light.otf")
TF_PCT = skia.Typeface.MakeFromFile("/usr/share/fonts/opentype/inter/InterDisplay-Regular.otf")


def mkfont(tf, size):
    f = skia.Font(tf, size)
    f.setSubpixel(True)
    f.setEdging(skia.Font.Edging.kAntiAlias)
    f.setHinting(skia.FontHinting.kNone)
    return f


F_TITLE = mkfont(TF_CJK_M, 33)
F_NUM = mkfont(TF_NUM, 220)
F_PCT = mkfont(TF_PCT, 84)
F_STATUS = mkfont(TF_CJK_R, 54)
F_BTN = mkfont(TF_CJK_M, 40)
F_BUB = mkfont(TF_CJK_R, 44)
DIGIT_ADV = max(F_NUM.measureText(d) for d in "0123456789")

# 弹窗几何（全局坐标）
DX, DY, DW, DH = 80, 556, 920, 740
CX, CY = DX + DW / 2, DY + DH / 2
PAD = 70
TRK_X0, TRK_X1, TRK_H = DX + PAD, DX + DW - PAD, 112
TRK_CY = DY + 432
FILL_INSET = 12
FILL_H = TRK_H - 2 * FILL_INSET
NUM_BASE = DY + 318
STATUS_BASE = DY + 566
BTN = (DX + DW - PAD - 196, DY + DH - 50 - 86, DX + DW - PAD, DY + DH - 50)


def paint(c, a=255):
    p = skia.Paint(AntiAlias=True)
    p.setColor(col(c, a))
    return p


def blur_paint(c, a, sigma):
    p = paint(c, a)
    p.setMaskFilter(skia.MaskFilter.MakeBlur(skia.kNormal_BlurStyle, sigma))
    return p


def rrect(x0, y0, x1, y1, r):
    return skia.RRect.MakeRectXY(skia.Rect.MakeLTRB(x0, y0, x1, y1), r, r)


def make_background():
    """暖灰白的桌面：极淡的两团色光 + 细颗粒 + 轻微暗角。只算一次。"""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    top, bot = np.array(rgb("#F4F4F7"), np.float32), np.array(rgb("#E7E8EE"), np.float32)
    g = (yy / H)[..., None]
    img = top * (1 - g) + bot * g
    for (bx, by, rad, c, a) in ((120, 260, 820, rgb("#D9E0FF"), 0.55),
                                (1000, 1720, 900, rgb("#FFE3D3"), 0.45),
                                (980, 420, 600, rgb("#F1E6FF"), 0.25)):
        m = np.exp(-((xx - bx) ** 2 + (yy - by) ** 2) / (2 * (rad / 2) ** 2))[..., None] * a
        img = img * (1 - m) + np.array(c, np.float32) * m
    v = ((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2
    img *= (1 - 0.05 * np.clip(v, 0, 1))[..., None]
    img += np.random.default_rng(3).normal(0, 1.4, (H, W, 1)).astype(np.float32)
    rgba = np.concatenate([np.clip(img, 0, 255).astype(np.uint8), np.full((H, W, 1), 255, np.uint8)], 2)
    return skia.Image.fromarray(np.ascontiguousarray(rgba), colorType=skia.kRGBA_8888_ColorType)


BG_IMAGE = None


def draw_bg(c):
    global BG_IMAGE
    if BG_IMAGE is None:
        BG_IMAGE = make_background()
    c.drawImage(BG_IMAGE, 0, 0)


def body_colors(b):
    heat, drain, done = b["heat"], b["drain"], b["done"]
    if heat < 0.5:
        pair = [mix(a, h, heat * 2) for a, h in zip(BODY_BLUE, BODY_HOT)]
    else:
        pair = [mix(h, r, heat * 2 - 1) for h, r in zip(BODY_HOT, BODY_RED)]
    if drain:  # 泄气：先变灰，再慢慢回到本色
        pair = [mix(p, d, drain) for p, d in zip(pair, BODY_DRAIN)]
    return [mix(p, d, done) for p, d in zip(pair, BODY_DONE)]


def draw_window(c):
    w = rrect(DX, DY, DX + DW, DY + DH, 46)
    for dy_, sig, a in ((2, 2, 16), (18, 26, 22), (56, 70, 26)):  # 多层柔和投影
        c.drawRRect(rrect(DX + 6, DY + dy_, DX + DW - 6, DY + DH + dy_, 46), blur_paint((24, 28, 48), a, sig))
    c.drawRRect(w, paint((255, 255, 255)))
    edge = paint((20, 24, 40), 16)
    edge.setStyle(skia.Paint.kStroke_Style)
    edge.setStrokeWidth(1.5)
    c.drawRRect(rrect(DX + 0.75, DY + 0.75, DX + DW - 0.75, DY + DH - 0.75, 45.5), edge)
    # 标题栏
    for i in range(3):
        c.drawCircle(DX + 50 + i * 36, DY + 50, 11, paint(rgb("#E3E5EA")))
    title = "进度条的一生"
    c.drawString(title, CX - F_TITLE.measureText(title) / 2, DY + 61, F_TITLE, paint(INK_MUTED))
    c.drawRect(skia.Rect.MakeLTRB(DX, DY + 99, DX + DW, DY + 100.5), paint((22, 26, 40), 14))


def draw_number(c, b, t):
    shown = int(round(progress(t)))
    s = str(shown)
    x = TRK_X0 - 6 + 0.5 * b["shx"]
    y = NUM_BASE + 0.32 * b["dy"] + 0.5 * b["shy"]
    ink = mix(INK, DONE_INK, b["done"])
    for ch in s:  # 等宽数字，跳格时不左右晃
        cw = F_NUM.measureText(ch)
        c.drawString(ch, x + (DIGIT_ADV - cw) / 2, y, F_NUM, paint(ink))
        x += DIGIT_ADV
    cap = 220 * 0.727
    c.drawString("%", x + 10, y - cap + 84 * 0.727, F_PCT, paint(mix(INK_MUTED, DONE_INK, b["done"])))


def capsule(x0, y0, x1, y1, front_rx=None):
    h = y1 - y0
    r = min(h / 2, (x1 - x0) / 2)
    rx = r if front_rx is None else max(4.0, min(r, front_rx))
    rr = skia.RRect()
    rr.setRectRadii(skia.Rect.MakeLTRB(x0, y0, x1, y1),
                    [skia.Point(r, r), skia.Point(rx, r), skia.Point(rx, r), skia.Point(r, r)])
    return rr


def draw_bar(c, b, t):
    sx, sy_ = 0.5 * b["shx"], 0.5 * b["shy"]
    # 轨道：一道浅浅的凹槽
    trk = rrect(TRK_X0 + sx, TRK_CY - TRK_H / 2 + sy_, TRK_X1 + sx, TRK_CY + TRK_H / 2 + sy_, TRK_H / 2)
    c.drawRRect(trk, paint(rgb("#ECEEF3")))
    c.save()
    c.clipRRect(trk, doAntiAlias=True)
    inner = blur_paint((20, 26, 50), 26, 6)
    inner.setStyle(skia.Paint.kStroke_Style)
    inner.setStrokeWidth(10)
    c.drawRRect(rrect(TRK_X0 + sx - 2, TRK_CY - TRK_H / 2 + sy_ + 4, TRK_X1 + sx + 2,
                      TRK_CY + TRK_H / 2 + sy_ + 10, TRK_H / 2), inner)
    c.restore()

    top_c, bot_c = body_colors(b)
    fh = FILL_H * b["sy"]
    inner0, inner1 = TRK_X0 + FILL_INSET, TRK_X1 - FILL_INSET
    pvis = clamp(progress(t) + b["pext"], 0, 100.4) / 100.0
    fw = FILL_H + (inner1 - inner0 - FILL_H) * pvis
    fx0 = inner0 + b["shx"]
    fcy = TRK_CY + b["dy"] + b["shy"]
    y0, y1 = fcy - fh / 2, fcy + fh / 2
    front = fh / 2 * (1 - 0.72 * b["press"])   # 顶在墙上，鼻尖被压扁
    shape = capsule(fx0, y0, fx0 + fw, y1, front)

    # 接触阴影：跳得越高越淡越小
    lift = clamp(-b["dy"] / 70)
    sa = 70 * (1 - 0.75 * lift)
    shrink = 14 + 30 * lift
    c.drawRRect(rrect(fx0 + shrink, TRK_CY + 6, fx0 + fw - shrink, TRK_CY + FILL_H / 2 + 6, FILL_H / 4),
                blur_paint(mix(bot_c, (10, 20, 60), 0.4), sa, 9 + 8 * lift))
    if b["done"] > 0:
        c.drawRRect(capsule(fx0 - 6, y0 - 6, fx0 + fw + 6, y1 + 6),
                    blur_paint(BODY_DONE[1], 115 * b["done"], 28))

    fp = skia.Paint(AntiAlias=True)
    fp.setShader(skia.GradientShader.MakeLinear(
        [skia.Point(0, y0), skia.Point(0, y1)], [col(top_c), col(bot_c)]))
    c.drawRRect(shape, fp)

    c.save()
    c.clipRRect(shape, doAntiAlias=True)
    # 顶部高光
    r = fh / 2
    hl = skia.Paint(AntiAlias=True)
    hl.setShader(skia.GradientShader.MakeLinear(
        [skia.Point(0, y0 + fh * 0.08), skia.Point(0, y0 + fh * 0.48)],
        [skia.Color(255, 255, 255, 88), skia.Color(255, 255, 255, 0)]))
    if fw > fh * 0.9:
        c.drawRRect(rrect(fx0 + r * 0.45, y0 + fh * 0.08, fx0 + fw - r * 0.45, y0 + fh * 0.5, fh * 0.21), hl)
    else:
        c.drawOval(skia.Rect.MakeLTRB(fx0 + fw * 0.22, y0 + fh * 0.1, fx0 + fw * 0.78, y0 + fh * 0.45), hl)
    # 底部一圈暗边，让它有体积
    rim = blur_paint(mix(bot_c, (0, 0, 40), 0.35), 90, 5)
    rim.setStyle(skia.Paint.kStroke_Style)
    rim.setStrokeWidth(6)
    c.drawRRect(capsule(fx0 - 2, y0 - 8, fx0 + fw + 2, y1 + 2, front), rim)
    # 完成时的一道扫光
    if 0 < b["shine"] < 1:
        px = lerp(fx0 - 220, fx0 + fw + 220, e_io(b["shine"]))
        sp = skia.Paint(AntiAlias=True)
        sp.setShader(skia.GradientShader.MakeLinear(
            [skia.Point(px - 140, 0), skia.Point(px + 140, 0)],
            [skia.Color(255, 255, 255, 0), skia.Color(255, 255, 255, 190), skia.Color(255, 255, 255, 0)],
            [0.0, 0.5, 1.0]))
        c.drawRect(skia.Rect.MakeLTRB(px - 150, y0 - 10, px + 150, y1 + 10), sp)
    c.restore()


def draw_status(c, t):
    cur = status_at(t)
    if not cur:
        return
    ts, txt, cps = cur
    x = TRK_X0
    for k, ch in enumerate(txt):
        tk = ts + k * cps
        w = F_STATUS.measureText(ch)
        if t >= tk:
            a = clamp((t - tk) / 0.10)
            rise = 9 * (1 - e_out(a))
            yoff = -16 if ch == "…" else 0    # 中文省略号居中
            c.drawString(ch, x, STATUS_BASE + rise + yoff, F_STATUS, paint(INK_SOFT, 255 * a))
        x += w


def draw_button(c, t):
    bx0, by0, bx1, by1 = BTN
    cur = cursor(t)
    hover = cur is not None and bx0 <= cur[0] <= bx1 and by0 <= cur[1] <= by1
    down = cur is not None and cur[2] > 0
    s = 1 + 0.06 * bump(t, T_BUBBLE_IN, T_BUBBLE_IN + 0.25) + 0.025 * bump(t, T_BUBBLE_IN + 0.3, T_BUBBLE_IN + 0.5)
    if down:
        s *= 0.965
    fill = rgb("#DCDFE5") if down else rgb("#ECEEF2") if hover else rgb("#F5F6F8")
    c.save()
    bcx, bcy = (bx0 + bx1) / 2, (by0 + by1) / 2
    c.translate(bcx, bcy)
    c.scale(s, s)
    c.translate(-bcx, -bcy)
    c.drawRRect(rrect(bx0, by0 + 2, bx1, by1 + 2, 24), paint((20, 24, 40), 10))
    c.drawRRect(rrect(bx0, by0, bx1, by1, 24), paint(fill))
    edge = paint((20, 24, 40), 30)
    edge.setStyle(skia.Paint.kStroke_Style)
    edge.setStrokeWidth(1.5)
    c.drawRRect(rrect(bx0 + 0.75, by0 + 0.75, bx1 - 0.75, by1 - 0.75, 23.5), edge)
    tw = F_BTN.measureText("取消")
    c.drawString("取消", bcx - tw / 2, bcy + 14, F_BTN, paint(rgb("#2A2E35")))
    c.restore()


def draw_dialog(c, t):
    b = body(t)
    draw_window(c)
    c.save()  # 会"看向"取消按钮的内容组
    piv = (CX, TRK_CY)
    c.translate(piv[0] + 5 * b["lean"], piv[1] + 2 * b["lean"])
    c.rotate(b["lean"])
    c.translate(-piv[0], -piv[1])
    draw_number(c, b, t)
    draw_bar(c, b, t)
    draw_status(c, t)
    c.restore()
    draw_button(c, t)


def draw_bubble(c, t):
    if not (T_BUBBLE_IN <= t < T_BUBBLE_OUT + 0.18):
        return
    if t < T_BUBBLE_OUT:
        d = t - T_BUBBLE_IN
        s = 1 - math.exp(-d / 0.07) * math.cos(2 * math.pi * 2.6 * d)
        a = clamp(d / 0.06)
    else:
        u = nrm(t, T_BUBBLE_OUT, T_BUBBLE_OUT + 0.18)
        s, a = 1 - 0.15 * u, 1 - e_out(u)
    tipx, tipy = (BTN[0] + BTN[2]) / 2, DY + DH + 16
    x1 = DX + DW
    x0 = x1 - 452
    y0 = tipy + 22
    lh = 66
    y1 = y0 + 38 * 2 + lh * len(BUBBLE_LINES) - 16
    c.save()
    c.translate(tipx, tipy)
    c.scale(s, s)
    c.translate(-tipx, -tipy)
    c.saveLayerAlpha(None, int(255 * a))
    path = skia.Path()
    path.addRRect(rrect(x0, y0, x1, y1, 28))
    tail = skia.Path()
    tail.moveTo(tipx - 20, y0 + 1)
    tail.quadTo(tipx - 4, y0 - 10, tipx, tipy)
    tail.quadTo(tipx + 4, y0 - 10, tipx + 20, y0 + 1)
    tail.close()
    path = skia.Op(path, tail, skia.PathOp.kUnion_PathOp)
    sh = blur_paint((10, 14, 30), 60, 20)
    c.save()
    c.translate(0, 14)
    c.drawPath(path, sh)
    c.restore()
    c.drawPath(path, paint(rgb("#2B2E35")))
    for i, line in enumerate(BUBBLE_LINES):
        c.drawString(line, x0 + 44, y0 + 38 + 44 + i * lh - 6, F_BUB, paint(rgb("#F3F4F6")))
    c.restore()
    c.restore()


ARROW = [(0, 0), (0, 23.5), (5.6, 18.0), (9.6, 27.0), (13.4, 25.4), (9.6, 16.6), (17.2, 16.6)]


def draw_cursor(c, t):
    cur = cursor(t)
    if cur is None:
        return
    x, y, down = cur
    k = 2.7 * (0.9 if down else 1.0)
    path = skia.Path()
    path.moveTo(x + ARROW[0][0] * k, y + ARROW[0][1] * k)
    for px, py in ARROW[1:]:
        path.lineTo(x + px * k, y + py * k)
    path.close()
    c.save()
    c.translate(3, 7)
    c.drawPath(path, blur_paint((0, 0, 20), 70, 6))
    c.restore()
    outline = paint((255, 255, 255))
    outline.setStyle(skia.Paint.kStrokeAndFill_Style)
    outline.setStrokeWidth(7)
    outline.setStrokeJoin(skia.Paint.kRound_Join)
    c.drawPath(path, outline)
    c.drawPath(path, paint(rgb("#111216")))


def dialog_transform(t):
    """返回 (可见, 缩放, 透明度, 纵向偏移)。"""
    if t >= T_CLOSE + 1 / FPS:
        return False, 0, 0, 0
    if t >= T_CLOSE:                       # "啪"——只剩一帧残影
        return True, 0.975, 0.3, 0
    if t < 0.9:
        s = 1 - 0.16 * math.exp(-t / 0.085) * math.cos(2 * math.pi * 2.3 * t)
        a = clamp(t / 0.1 + 0.15)
        return True, s, a, 24 * math.exp(-t / 0.07)
    return True, 1.0, 1.0, 0


def render(c, t):
    draw_bg(c)
    vis, s, a, oy = dialog_transform(t)
    if vis:
        c.save()
        c.translate(CX, CY + oy)
        c.scale(s, s)
        c.translate(-CX, -CY)
        if a < 1:
            c.saveLayerAlpha(None, int(255 * a))
        draw_dialog(c, t)
        if a < 1:
            c.restore()
        c.restore()
    draw_bubble(c, t)
    draw_cursor(c, t)


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


def snd_mouse_down():
    """鼠标按下的一声轻"咔"。"""
    t = tt(0.03)
    n = bp(RNG.standard_normal(len(t)), 2000, 8000) * np.exp(-t / 0.0018)
    k = np.sin(2 * np.pi * 1900 * t) * np.exp(-t / 0.004)
    return 0.10 * n + 0.05 * k


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
    s = np.sin(ph) + 0.165 * np.sin(3 * ph) + 0.06 * np.sin(5 * ph)
    e = np.minimum(1, t / 0.004) * np.exp(-t / 0.11)
    return s * e


def gate(t, windows, ramp=0.004):
    g = np.zeros_like(t)
    for a, b in windows:
        g = np.maximum(g, np.clip((t - a) / ramp + 1, 0, 1) * np.clip((b - t) / ramp, 0, 1))
    return g


def tick_events():
    """从进度函数本身推出每一格的时间，保证"嗒"和数字变化同帧。"""
    prev = int(round(progress(0)))
    ev = []
    for t in np.arange(0, T_CLOSE, 0.001):
        v = int(round(progress(t)))
        if v != prev:
            for k in range(abs(v - prev)):
                ev.append((t, prev + (k + 1) * (1 if v > prev else -1), v < prev))
            prev = v
    return ev


def build_audio():
    fx = np.zeros(NS)
    mus = np.zeros(NS)
    T = np.arange(NS) / SR

    add(fx, 0.0, snd_ding())
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
    add(fx, 36.6, snd_breath(0.45, 0.05))   # 呼气
    add(fx, T_DONE, snd_chime())
    add(fx, T_CUR_DOWN, snd_mouse_down())

    # 背景小旋律
    def melody(start, stop, base_iv, speedup):
        t, i = start, 0
        while t < stop:
            add(mus, t, snd_note(PAT[i % len(PAT)]))
            r = 1 + speedup * clamp(progress(t) / 99) if speedup else 1
            t += base_iv / r
            i += 1
    melody(0.3, T_STUCK, 0.25, 0.45)
    melody(T_MELODY_BACK, T_CLOSE, 0.36, 0)
    mus = lp(mus, 3200) * 0.075
    mus *= gate(T, [(0, T_STUCK), (T_MELODY_BACK - 0.01, T_CLOSE)])

    # 弹窗关掉的瞬间：一切声音被掐断，然后彻底安静直到循环回开头
    fx *= gate(T, [(-1, T_CLOSE)], ramp=0.003)
    add(fx, T_CLOSE, snd_pa())

    mix_ = fx + mus
    peak = np.max(np.abs(mix_))
    mix_ = np.tanh(mix_ / peak * 1.2) / math.tanh(1.2) * 0.79  # 柔和限幅，留出 AAC 余量
    return mix_


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
        outdir = os.path.join(HERE, "check")
        os.makedirs(outdir, exist_ok=True)
        for s in sys.argv[2].split(","):
            t = float(s)
            arr = np.zeros((H, W, 4), np.uint8)
            surf = skia.Surface(arr)
            render(surf.getCanvas(), t)
            surf.makeImageSnapshot().save(os.path.join(outdir, f"f_{t:06.2f}.png"))
        return

    build = os.path.join(HERE, "build")
    os.makedirs(build, exist_ok=True)
    wav = os.path.join(build, "audio.wav")
    write_wav(wav, build_audio())

    out = os.path.join(HERE, "进度条的一生.mp4")
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-i", wav,
           "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    arr = np.zeros((H, W, 4), np.uint8)
    surf = skia.Surface(arr)
    canvas = surf.getCanvas()
    for i in range(NFR):
        render(canvas, i / FPS)
        proc.stdin.write(arr.tobytes())
        if i % 300 == 0:
            print("frame", i, "/", NFR, flush=True)
    proc.stdin.close()
    proc.wait()
    print("done ->", out)


if __name__ == "__main__":
    main()
