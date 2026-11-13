// Master timeline (seconds). Beat-snapping happens in later passes; content follows the storyboard.
export type Cue = {from: number; to: number; zh: string; en: string};
export type Shot = {
  id: string; from: number; to: number; chapter: string; chapterEn: string;
  palette: 'intro' | 'A' | 'B' | 'forget' | 'outro';
  note?: string; // annotation bar (formula / source)
  illustration?: boolean;
  cues: Cue[];
};

export const TOTAL = 228;

export const SHOTS: Shot[] = [
  {id: 'O1', from: 0, to: 13, chapter: '开场', chapterEn: 'INTRO', palette: 'intro', illustration: true, cues: [
    {from: 1.2, to: 7.6, zh: '你打下“在吗”，附上一张照片，按下回车', en: 'You type "hi", attach a photo, hit Enter.'},
    {from: 8.4, to: 12.8, zh: '对面是朋友，还是 AI，命运完全不同', en: 'Friend or AI — two completely different journeys.'},
  ]},
  {id: 'O2', from: 13, to: 20, chapter: '开场', chapterEn: 'INTRO', palette: 'intro', cues: []},
  {id: 'A0', from: 20, to: 22, chapter: 'A 面 · 被搬运', chapterEn: 'SIDE A · DELIVERED', palette: 'A', cues: []},
  {id: 'A1', from: 22, to: 30, chapter: 'A 面 · 被搬运', chapterEn: 'SIDE A · DELIVERED', palette: 'A', illustration: true,
    note: '今天：3,200 km ÷ 204,000 km/s ≈ 16 ms  ·  IEEE Spectrum, 2019', cues: [
    {from: 0.4, to: 7.8, zh: '1858 年，98 个词的电报跨大西洋，发了近 16 小时', en: '1858: a 98-word telegram took ~16 hours to cross the Atlantic.'},
  ]},
  {id: 'A2', from: 30, to: 42, chapter: 'A 面 · 被搬运', chapterEn: 'SIDE A · DELIVERED', palette: 'A', illustration: true,
    note: 'UTF-8：在 = E5 9C A8，吗 = E5 90 97  ·  3 MB ÷ 6 B ≈ 50 万倍', cues: [
    {from: 0.3, to: 7.4, zh: '“在吗”只有 6 个字节，一张照片约 3 MB——大了几十万倍', en: '"Hi" is 6 bytes; a photo ~3 MB — hundreds of thousands of times bigger.'},
    {from: 7.6, to: 11.8, zh: '所以照片往往会先被压缩', en: 'So photos are often compressed first.'},
  ]},
  {id: 'A3', from: 42, to: 52, chapter: 'A 面 · 被搬运', chapterEn: 'SIDE A · DELIVERED', palette: 'A', illustration: true,
    note: '以太网 MTU 1500 B − 头部 ≈ 1.4 KB 内容/包  ·  3 MB ÷ 1.4 KB ≈ 2,100+', cues: [
    {from: 0.4, to: 9.6, zh: '一句话，一个包就装下；一张照片，要拆成两千多个包', en: 'One packet for the text; 2,000+ for the photo.'},
  ]},
  {id: 'A4', from: 52, to: 60, chapter: 'A 面 · 被搬运', chapterEn: 'SIDE A · DELIVERED', palette: 'A', illustration: true,
    note: '光在光纤里 ≈ c ÷ 1.47 ≈ 204,000 km/s', cues: [
    {from: 0.4, to: 7.6, zh: '变成电磁波，再变成光，在玻璃丝里一路反射', en: 'Radio waves, then light, through glass.'},
  ]},
  {id: 'A5', from: 60, to: 75, chapter: 'A 面 · 被搬运', chapterEn: 'SIDE A · DELIVERED', palette: 'A',
    note: '10,000 ÷ 204,000 ≈ 49 ms  ·  超过 99% 的国际数据走海缆（ITU, 2025）', cues: [
    {from: 0.6, to: 7.4, zh: '它们可能各走各的路，跨过太平洋', en: 'They may take different routes across the Pacific —'},
    {from: 7.6, to: 14.6, zh: '约 1 万公里，只要约 50 毫秒', en: '~10,000 km in ~50 ms.'},
  ]},
  {id: 'A6', from: 75, to: 85, chapter: 'A 面 · 被搬运', chapterEn: 'SIDE A · DELIVERED', palette: 'A', illustration: true,
    note: '常见做法：图片单独上传到文件服务器，再把链接发给对方', cues: [
    {from: 0.4, to: 5.2, zh: '到了再按编号拼回去，丢了的补发', en: 'Reassembled by number, lost ones resent;'},
    {from: 5.4, to: 9.8, zh: '对方先看到缩略图，再看到原图', en: 'a thumbnail first, then the full photo.'},
  ]},
  {id: 'BR', from: 85, to: 90, chapter: '桥段', chapterEn: 'BRIDGE', palette: 'B', cues: [
    {from: 0.5, to: 4.8, zh: '但如果收件人是 AI 呢？', en: 'But what if the recipient is an AI?'},
  ]},
  {id: 'B0', from: 90, to: 92, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', cues: []},
  {id: 'B1', from: 92, to: 106, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', illustration: true,
    note: '常见的大模型接口不保存对话，历史随每次请求发送；“记忆”功能的常见做法是把笔记一起塞进去', cues: [
    {from: 0.5, to: 5.6, zh: '你以为只发了两个字和一张图？', en: 'Think you sent two characters and a photo?'},
    {from: 6.0, to: 13.6, zh: '其实每一次，整段对话都会被重新发过去', en: 'Every time, the whole conversation is sent again.'},
  ]},
  {id: 'B2', from: 106, to: 114, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', illustration: true,
    note: '常见做法，因产品而异', cues: [
    {from: 0.4, to: 7.6, zh: '先验身份、排队，再过一遍安全检查', en: 'Authentication, rate limits, a safety check.'},
  ]},
  {id: 'B3', from: 114, to: 124, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', illustration: true,
    note: '量级：大型 AI 集群公开报道可达 10 万块 GPU 量级', cues: [
    {from: 0.5, to: 9.6, zh: '然后进入一座装着上万块 AI 芯片的机房', en: 'Into a hall of tens of thousands of AI chips.'},
  ]},
  {id: 'B4', from: 124, to: 136, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', illustration: true,
    note: '连续批处理：Orca (OSDI 2022) · vLLM / PagedAttention (SOSP 2023)', cues: [
    {from: 0.5, to: 11.6, zh: '你的消息，正和几十个陌生人的消息拼成一批，同时计算', en: "Batched with dozens of strangers', computed together."},
  ]},
  {id: 'B5', from: 136, to: 150, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', illustration: true,
    note: '《An Image is Worth 16x16 Words》, 2020  ·  数量为示意，取决于分辨率和模型', cues: [
    {from: 0.4, to: 6.4, zh: '文字被切成 token：“在吗”只有两三个', en: 'Text becomes tokens — "hi" is just two or three.'},
    {from: 6.8, to: 13.6, zh: '照片被切成 16×16 的小方块，一张图就是几百个', en: 'A photo becomes 16×16 patches — hundreds of them.'},
  ]},
  {id: 'B6', from: 150, to: 162, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', illustration: true,
    note: 'Prefill（预填充）阶段：并行读完输入，生成 KV Cache', cues: [
    {from: 0.4, to: 11.6, zh: '它先一口气读完全部内容，把理解存成“记忆”', en: 'It reads everything at once, storing its understanding as memory.'},
  ]},
  {id: 'B7', from: 162, to: 176, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', illustration: true,
    note: '温度采样  ·  以公开论文中的 GPT-3 为例：词表约 5 万，每个 token 前向约 2N ≈ 3,500 亿次运算', cues: [
    {from: 0.4, to: 6.6, zh: '然后一次只写一个字，每个字都从几万个候选里挑', en: 'One token at a time, from tens of thousands of candidates —'},
    {from: 7.0, to: 13.6, zh: '带点随机，所以同一个问题，每次回答都可能不同', en: 'with randomness, so answers vary.'},
  ]},
  {id: 'B8', from: 176, to: 190, chapter: 'B 面 · 被读懂', chapterEn: 'SIDE B · UNDERSTOOD', palette: 'B', illustration: true,
    note: '流式输出（Server-Sent Events）', cues: [
    {from: 0.6, to: 13.4, zh: '写出一个就发回一个——所以回复是一个字一个字冒出来的', en: "Each token streams back instantly — that's why replies appear word by word."},
  ]},
  {id: 'F1', from: 190, to: 205, chapter: '反转 · 被忘记', chapterEn: 'TWIST · FORGOTTEN', palette: 'forget', illustration: true,
    note: '部分服务提供提示缓存（prompt caching），会短时间复用前缀的计算结果', cues: [
    {from: 1.0, to: 7.4, zh: '说完的那一刻，这段“记忆”就被清空，或者只短暂缓存一会儿', en: 'The moment it finishes, the memory is cleared — or cached only briefly.'},
    {from: 7.8, to: 14.6, zh: '下一次你发消息，它会把你们的整段对话，连同那张照片，再从头读一遍', en: 'Next time, it re-reads your whole conversation — photo included — from the top.'},
  ]},
  {id: 'C1', from: 205, to: 220, chapter: '对比', chapterEn: 'SIDE BY SIDE', palette: 'outro', cues: [
    {from: 9.6, to: 15, zh: '同样是按下回车——一条被送达，一条被读懂。然后，被忘记。', en: 'Same Enter key — one delivered, one understood. And then, forgotten.'},
  ]},
  {id: 'R1', from: 220, to: 228, chapter: '参考资料', chapterEn: 'REFERENCES', palette: 'outro', cues: []},
];

export const CHAPTERS = [
  {label: '开场', from: 0}, {label: 'A 面', from: 20}, {label: 'B 面', from: 90}, {label: '反转', from: 190}, {label: '收尾', from: 205},
];

export const shotAt = (t: number) => SHOTS.find((s) => t >= s.from && t < s.to) ?? SHOTS[SHOTS.length - 1];
