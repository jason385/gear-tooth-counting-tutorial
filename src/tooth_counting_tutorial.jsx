import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// METHODS DATA
// ─────────────────────────────────────────────────────────────────────────────
const METHODS = [
  {
    id: 1,
    name: "極座標展開 + 峰值偵測",
    eng: "Polar Transform + Peak Detection",
    tag: "推薦方法",
    tagColor: "#10b981",
    difficulty: 3,
    speed: 5,
    accuracy: 5,
    desc: "把齒輪邊緣展開成一維信號，齒頂出現為峰值，計算峰值數即齒數。",
    steps: [
      "偵測齒輪圓心與外徑",
      "cv2.linearPolar 展開成矩形",
      "提取外環帶徑向剖面",
      "一維峰值偵測 (scipy.find_peaks)",
    ],
    pros: ["精度最高", "不受旋轉影響", "一維問題大幅簡化"],
    cons: ["需先準確找到圓心", "中心偏移影響精度"],
    code: `import cv2
import numpy as np
from scipy.signal import find_peaks

# 讀取齒輪影像（灰階）
img = cv2.imread("gear.png", cv2.IMREAD_GRAYSCALE)
h, w = img.shape

# ① 偵測齒輪圓心（Hough 圓偵測）
blurred = cv2.GaussianBlur(img, (9, 9), 2)
circles = cv2.HoughCircles(
    blurred, cv2.HOUGH_GRADIENT, dp=1,
    minDist=100, param1=50, param2=30,
    minRadius=50, maxRadius=300
)
cx, cy, R = map(int, circles[0][0])  # 圓心 (cx,cy)，外徑 R

# ② 極座標展開 (linearPolar)
MAX_R = R + 20
polar = cv2.linearPolar(
    img, (cx, cy), MAX_R,
    cv2.WARP_FILL_OUTLIERS
)
# polar shape: (360, MAX_R) — 每列代表 1°

# ③ 提取外環帶（齒頂附近）
band = polar[:, int(R * 0.85): int(R * 1.02)]
signal = band.mean(axis=1)          # 每角度平均強度

# ④ 峰值偵測
peaks, _ = find_peaks(
    signal,
    height=signal.mean() + signal.std() * 0.3,
    distance=3                       # 相鄰兩齒至少 3°
)
tooth_count = len(peaks)
print(f"偵測齒數：{tooth_count}")

# 視覺化
color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for p in peaks:
    ang = p * np.pi / 180
    px = int(cx + R * np.cos(ang))
    py = int(cy + R * np.sin(ang))
    cv2.circle(color, (px, py), 5, (0, 255, 80), -1)
cv2.putText(color, f"Teeth: {tooth_count}", (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 80), 2)
cv2.imshow("Result", color)
cv2.waitKey(0)
`,
    viz: "polar",
  },
  {
    id: 2,
    name: "輪廓凸性缺陷",
    eng: "Contour + Convexity Defects",
    tag: "傳統方法",
    tagColor: "#0ea5e9",
    difficulty: 3,
    speed: 4,
    accuracy: 4,
    desc: "找齒輪輪廓後計算凸包，凸性缺陷的數量對應齒槽數（等於齒數）。",
    steps: [
      "Canny 邊緣 + 形態學閉合",
      "findContours 取最大輪廓",
      "convexHull 取凸包",
      "convexityDefects 計算缺陷數量",
    ],
    pros: ["直觀幾何意義", "不需知道圓心", "對清晰輪廓準確"],
    cons: ["需要清晰的輪廓", "輕微缺陷易誤判", "對噪音敏感"],
    code: `import cv2
import numpy as np

img = cv2.imread("gear.png", cv2.IMREAD_GRAYSCALE)
color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

# ① Canny 邊緣偵測 + 形態學閉合
edges = cv2.Canny(img, 50, 150)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

# ② 取最大輪廓（假設齒輪為最大連通區域）
contours, _ = cv2.findContours(
    closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE
)
gear_cnt = max(contours, key=cv2.contourArea)

# ③ 計算凸包
hull_idx = cv2.convexHull(gear_cnt, returnPoints=False)
hull_pts = cv2.convexHull(gear_cnt, returnPoints=True)

# ④ 凸性缺陷
defects = cv2.convexityDefects(gear_cnt, hull_idx)

# 過濾：只保留深度夠大的缺陷（齒槽）
MIN_DEPTH = 5  # 像素
significant = [
    d for d in defects[:, 0]
    if d[3] / 256.0 > MIN_DEPTH
]
tooth_count = len(significant)
print(f"偵測齒數：{tooth_count}")

# 繪製凸包 & 缺陷點
cv2.drawContours(color, [hull_pts], -1, (255, 200, 0), 2)
for d in significant:
    s, e, f, _ = d
    far = tuple(gear_cnt[f][0])
    cv2.circle(color, far, 6, (0, 80, 255), -1)

cv2.putText(color, f"Teeth: {tooth_count}", (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 80), 2)
cv2.imshow("Result", color)
cv2.waitKey(0)
`,
    viz: "convex",
  },
  {
    id: 3,
    name: "徑向剖面峰值",
    eng: "Radial Profile Peak Counting",
    tag: "傳統方法",
    tagColor: "#0ea5e9",
    difficulty: 2,
    speed: 5,
    accuracy: 4,
    desc: "從圓心向外沿半徑方向取多條剖面，在齒頂半徑處的亮度隨角度呈現周期性變化，計算周期數即齒數。",
    steps: [
      "偵測圓心",
      "沿 360° 方向取外徑像素強度",
      "強度信號低通濾波",
      "計算零交叉或峰值數量",
    ],
    pros: ["計算簡單快速", "不需輪廓提取", "對低對比度影像有效"],
    cons: ["需要知道大約外徑", "光照不均影響信號"],
    code: `import cv2
import numpy as np
from scipy.signal import find_peaks, savgol_filter

img = cv2.imread("gear.png", cv2.IMREAD_GRAYSCALE)
h, w = img.shape

# ① 粗估圓心（質心法）
_, binary = cv2.threshold(img, 0, 255,
                           cv2.THRESH_BINARY + cv2.THRESH_OTSU)
M = cv2.moments(binary)
cx = int(M["m10"] / M["m00"])
cy = int(M["m01"] / M["m00"])

# 粗估外徑（取最遠白色點距離）
ys, xs = np.where(binary > 0)
dists = np.sqrt((xs - cx)**2 + (ys - cy)**2)
R = int(np.percentile(dists, 97))

# ② 沿 360° 採樣外徑像素強度
N_angles = 720  # 每 0.5° 一個樣本
angles = np.linspace(0, 2 * np.pi, N_angles, endpoint=False)
sample_r = int(R * 0.93)           # 齒頂附近半徑

xs_s = (cx + sample_r * np.cos(angles)).astype(int)
ys_s = (cy + sample_r * np.sin(angles)).astype(int)

# 邊界夾緊
xs_s = np.clip(xs_s, 0, w - 1)
ys_s = np.clip(ys_s, 0, h - 1)
signal = img[ys_s, xs_s].astype(float)

# ③ Savitzky-Golay 低通平滑
smoothed = savgol_filter(signal, window_length=15, polyorder=3)

# ④ 峰值偵測
peaks, _ = find_peaks(
    smoothed,
    height=smoothed.mean(),
    distance=N_angles // 60       # 假設齒數 < 60
)
tooth_count = len(peaks)
print(f"偵測齒數：{tooth_count}")

# 視覺化
color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
for p in peaks:
    px = int(cx + sample_r * np.cos(angles[p]))
    py = int(cy + sample_r * np.sin(angles[p]))
    cv2.circle(color, (px, py), 5, (0, 255, 80), -1)

cv2.putText(color, f"Teeth: {tooth_count}", (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 80), 2)
cv2.imshow("Result", color)
cv2.waitKey(0)
`,
    viz: "radial",
  },
  {
    id: 4,
    name: "Canny 邊緣角頻率分析",
    eng: "Canny + Angular Frequency (FFT)",
    tag: "傳統方法",
    tagColor: "#0ea5e9",
    difficulty: 3,
    speed: 4,
    accuracy: 3,
    desc: "對齒輪邊緣影像做傅立葉頻率分析，主頻率峰值對應齒輪的角頻率，從而推算齒數。",
    steps: [
      "Canny 邊緣偵測",
      "極座標轉換邊緣圖",
      "對角度方向做 FFT",
      "找主頻率峰值換算齒數",
    ],
    pros: ["可同時分析多個特徵頻率", "數學基礎嚴謹"],
    cons: ["需要解讀頻域", "對紋理複雜影像干擾多"],
    code: `import cv2
import numpy as np

img = cv2.imread("gear.png", cv2.IMREAD_GRAYSCALE)
h, w = img.shape

# ① Canny 邊緣偵測
edges = cv2.Canny(img, 40, 120)

# 取圓心（簡化：影像中心）
cx, cy = w // 2, h // 2

# ② 極座標轉換邊緣圖
MAX_R = min(cx, cy) - 5
polar = cv2.linearPolar(
    edges.astype(np.float32),
    (cx, cy), MAX_R,
    cv2.WARP_FILL_OUTLIERS
)
# shape: (360, MAX_R)

# ③ 取外環帶（齒頂區域），沿角度方向求和 → 1D 信號
outer_band = polar[:, int(MAX_R * 0.8):]
angle_signal = outer_band.sum(axis=1)   # 長度 360

# ④ FFT — 找主頻率
fft = np.fft.rfft(angle_signal)
freqs = np.fft.rfftfreq(len(angle_signal))
magnitude = np.abs(fft)

# 忽略 DC 項，找最大峰值頻率
magnitude[0] = 0
dominant_freq_idx = np.argmax(magnitude)
# 頻率 * 360 = 每轉齒數
tooth_count = int(round(dominant_freq_idx))
print(f"FFT 主頻率索引：{dominant_freq_idx}")
print(f"偵測齒數：{tooth_count}")

# 視覺化頻譜
import matplotlib.pyplot as plt
fig, axes = plt.subplots(1, 2, figsize=(12, 4))
axes[0].plot(angle_signal)
axes[0].set_title("角度方向邊緣強度信號")
axes[1].plot(magnitude[:60])
axes[1].axvline(dominant_freq_idx, color="red",
                label=f"主頻率 = {tooth_count} 齒")
axes[1].set_title("FFT 頻譜")
axes[1].legend()
plt.tight_layout()
plt.show()
`,
    viz: "canny",
  },
  {
    id: 5,
    name: "模板齒形匹配",
    eng: "Tooth Template Matching",
    tag: "傳統方法",
    tagColor: "#0ea5e9",
    difficulty: 2,
    speed: 3,
    accuracy: 3,
    desc: "裁出單一齒形作為模板，在齒輪影像上旋轉搜尋，命中次數即齒數。",
    steps: [
      "手動截取一顆齒作為模板",
      "沿圓周旋轉掃描匹配",
      "NMS 去除重複命中",
      "統計命中總數",
    ],
    pros: ["直觀易懂", "對特定齒形準確"],
    cons: ["需手動準備模板", "對磨損齒輪不穩定", "旋轉角度採樣影響精度"],
    code: `import cv2
import numpy as np

img = cv2.imread("gear.png", cv2.IMREAD_GRAYSCALE)
color = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
h, w = img.shape
cx, cy = w // 2, h // 2

# ① 裁取模板（第一顆齒附近區域）
# 假設已知齒頂半徑 R=120，取 0° 方向齒頂小塊
R = 120
HALF = 18  # 模板半寬（像素）
tmpl = img[cy - HALF: cy + HALF,
           cx + R - HALF: cx + R + HALF].copy()

# ② 沿圓周旋轉掃描 (每 1° 一次)
THRESHOLD = 0.72   # 匹配分數門檻
scores = []

for angle_deg in range(360):
    ang = np.deg2rad(angle_deg)
    # 旋轉影像讓當前角度對準 0° 位置
    M = cv2.getRotationMatrix2D((cx, cy), -angle_deg, 1.0)
    rotated = cv2.warpAffine(img, M, (w, h))

    roi = rotated[cy - HALF: cy + HALF,
                  cx + R - HALF: cx + R + HALF]
    if roi.shape != tmpl.shape:
        scores.append(0)
        continue

    res = cv2.matchTemplate(roi, tmpl, cv2.TM_CCOEFF_NORMED)
    scores.append(float(res.max()))

scores = np.array(scores)

# ③ Non-Maximum Suppression (角度域)
hits = []
for i, s in enumerate(scores):
    if s >= THRESHOLD:
        window = scores[max(0, i-3): i+4]
        if s == window.max():
            hits.append(i)

tooth_count = len(hits)
print(f"偵測齒數：{tooth_count}")

# ④ 視覺化命中位置
for ang_deg in hits:
    ang = np.deg2rad(ang_deg)
    px = int(cx + R * np.cos(ang))
    py = int(cy + R * np.sin(ang))
    cv2.circle(color, (px, py), 7, (0, 255, 80), -1)

cv2.putText(color, f"Teeth: {tooth_count}", (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 80), 2)
cv2.imshow("Result", color)
cv2.waitKey(0)
`,
    viz: "template",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function Stars({ value, max = 5, color = "#f59e0b" }) {
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{
            color: i < value ? color : "#1e293b",
            fontSize: 13,
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GEAR DRAWING
// ─────────────────────────────────────────────────────────────────────────────
const TEETH = 16;
const GCX = 110, GCY = 110, GR = 85, Gr = 72;

function drawGear(ctx, cx, cy, R, r, teeth, color, edgeColor, rotation = 0) {
  const step = (2 * Math.PI) / teeth;
  const tw = step * 0.42;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const base = step * i + rotation;
    ctx.lineTo(r * Math.cos(base - tw / 2) + cx, r * Math.sin(base - tw / 2) + cy);
    ctx.lineTo(R * Math.cos(base - tw * 0.38) + cx, R * Math.sin(base - tw * 0.38) + cy);
    ctx.lineTo(R * Math.cos(base + tw * 0.38) + cx, R * Math.sin(base + tw * 0.38) + cy);
    ctx.lineTo(r * Math.cos(base + tw / 2) + cx, r * Math.sin(base + tw / 2) + cy);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // center hole
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = "#060d1a";
  ctx.fill();
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────────────────
// GEAR CANVAS
// ─────────────────────────────────────────────────────────────────────────────
function GearCanvas({ viz, animated = true }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const frameRef = useRef(0);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const t = animated ? (frameRef.current += 1) : 100;

    // clear
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#060d1a";
    ctx.fillRect(0, 0, W, H);

    const step = (2 * Math.PI) / TEETH;

    // ── draw base gear ──
    drawGear(ctx, GCX, GCY, GR, Gr, TEETH, "#1e3a5f", "#38bdf8", 0);

    if (viz === "polar") {
      // Phase 1 (t < 80): scan line sweeping around gear
      // Phase 2 (t >= 80): show polar rectangle to the right + peaks
      if (t < 80) {
        // rotating scan line
        const ang = ((t / 80) * 2 * Math.PI) % (2 * Math.PI);
        ctx.save();
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(GCX, GCY);
        ctx.lineTo(GCX + (GR + 10) * Math.cos(ang), GCY + (GR + 10) * Math.sin(ang));
        ctx.stroke();
        // partial arc trace
        ctx.beginPath();
        ctx.arc(GCX, GCY, GR + 3, 0, ang);
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // label
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px monospace";
        ctx.fillText("掃描邊緣…", 4, H - 6);
      } else {
        // draw polar rectangle (right side)
        const px = 4, py = 20;
        const pw = 80, ph = 60;
        ctx.save();
        // background for polar strip
        ctx.fillStyle = "#0f2137";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeRect(px, py, pw, ph);
        ctx.fillStyle = "#64748b";
        ctx.font = "8px sans-serif";
        ctx.fillText("極座標展開", px + 4, py - 4);

        // draw signal inside rect (sine-like matching gear profile)
        ctx.beginPath();
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.5;
        for (let x = 0; x < pw; x++) {
          const frac = x / pw;
          const val = 0.5 + 0.38 * Math.cos(frac * 2 * Math.PI * TEETH);
          const y = py + ph - val * ph;
          x === 0 ? ctx.moveTo(px + x, y) : ctx.lineTo(px + x, y);
        }
        ctx.stroke();

        // peaks (blinking)
        const blink = Math.sin(t * 0.15) > 0;
        if (blink) {
          for (let i = 0; i < TEETH; i++) {
            const fx = px + (i / TEETH) * pw + pw / TEETH / 2;
            const fy = py + ph - 0.88 * ph;
            ctx.beginPath();
            ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = "#f59e0b";
            ctx.fill();
          }
        }

        // count label
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(`偵測齒數：${TEETH}`, px, py + ph + 14);

        ctx.restore();
      }
    } else if (viz === "convex") {
      // Phase 1 (t<60): draw convex hull appearing
      // Phase 2 (t>=60): highlight defect points
      const progress = Math.min(t / 60, 1);

      // convex hull approximation (slightly larger circle)
      ctx.save();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.globalAlpha = progress;
      ctx.beginPath();
      ctx.arc(GCX, GCY, GR + 4, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // defect points between teeth (valleys)
      if (t >= 60) {
        const blink = Math.sin(t * 0.12) > 0;
        for (let i = 0; i < TEETH; i++) {
          const ang = step * i + step * 0.5; // valley center
          const px2 = GCX + (Gr - 4) * Math.cos(ang);
          const py2 = GCY + (Gr - 4) * Math.sin(ang);
          ctx.beginPath();
          ctx.arc(px2, py2, blink ? 4 : 3, 0, Math.PI * 2);
          ctx.fillStyle = "#f87171";
          ctx.fill();
        }
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(`凸性缺陷：${TEETH} 個`, 4, H - 6);
      }
    } else if (viz === "radial") {
      // show radial scan lines + sine wave overlay
      const numLines = 24;
      ctx.save();
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < numLines; i++) {
        const ang = (i / numLines) * 2 * Math.PI;
        // animate: lines appear progressively
        if (i / numLines > ((t % 120) / 120)) continue;
        ctx.beginPath();
        ctx.moveTo(GCX, GCY);
        ctx.lineTo(GCX + (GR + 8) * Math.cos(ang), GCY + (GR + 8) * Math.sin(ang));
        ctx.stroke();
      }
      ctx.restore();

      // sine-wave signal overlay (arc at radius GR+18)
      ctx.save();
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      const SIG_R = GR + 18;
      for (let deg = 0; deg <= 360; deg++) {
        const frac = deg / 360;
        const amp = 8 * Math.sin(frac * 2 * Math.PI * TEETH);
        const r2 = SIG_R + amp;
        const ang = (deg / 360) * 2 * Math.PI - Math.PI / 2;
        const x2 = GCX + r2 * Math.cos(ang);
        const y2 = GCY + r2 * Math.sin(ang);
        deg === 0 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "#a78bfa";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(`周期數 = 齒數：${TEETH}`, 4, H - 6);
    } else if (viz === "canny") {
      // show edge glow + FFT bars
      // edge glow
      ctx.save();
      const glowAlpha = 0.45 + 0.25 * Math.sin(t * 0.1);
      ctx.strokeStyle = `rgba(250,204,21,${glowAlpha})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 8;
      // trace gear outline
      const stepA = (2 * Math.PI) / TEETH;
      const twA = stepA * 0.42;
      ctx.beginPath();
      for (let i = 0; i < TEETH; i++) {
        const base = stepA * i;
        ctx.lineTo(Gr * Math.cos(base - twA / 2) + GCX, Gr * Math.sin(base - twA / 2) + GCY);
        ctx.lineTo(GR * Math.cos(base - twA * 0.38) + GCX, GR * Math.sin(base - twA * 0.38) + GCY);
        ctx.lineTo(GR * Math.cos(base + twA * 0.38) + GCX, GR * Math.sin(base + twA * 0.38) + GCY);
        ctx.lineTo(Gr * Math.cos(base + twA / 2) + GCX, Gr * Math.sin(base + twA / 2) + GCY);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // FFT bars at bottom
      const barW = 4, barGap = 2;
      const totalBars = 20;
      const barAreaX = 4, barAreaY = H - 42;
      ctx.save();
      ctx.fillStyle = "#64748b";
      ctx.font = "8px sans-serif";
      ctx.fillText("FFT 頻譜", barAreaX, barAreaY - 2);
      for (let b = 0; b < totalBars; b++) {
        // highlight dominant frequency (tooth count)
        const isDominant = b === TEETH;
        const barH = isDominant
          ? 28 + 4 * Math.sin(t * 0.15)
          : 4 + 8 * Math.random() * (b === 0 ? 2 : 1);
        ctx.fillStyle = isDominant ? "#f59e0b" : "#1e40af";
        ctx.fillRect(
          barAreaX + b * (barW + barGap),
          barAreaY + 32 - barH,
          barW,
          barH
        );
      }
      ctx.fillStyle = "#10b981";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText(`主頻 f=${TEETH} → 齒數=${TEETH}`, barAreaX, H - 2);
      ctx.restore();
    } else if (viz === "template") {
      // show one tooth highlighted, then stamps around
      const toothIdx = Math.floor(t / 18) % TEETH;
      const revealedCount = Math.min(Math.floor(t / 18), TEETH);

      // highlight revealed teeth
      for (let i = 0; i < revealedCount; i++) {
        const ang = step * i;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#10b981";
        ctx.beginPath();
        const tw2 = step * 0.42;
        ctx.lineTo(Gr * Math.cos(ang - tw2 / 2) + GCX, Gr * Math.sin(ang - tw2 / 2) + GCY);
        ctx.lineTo(GR * Math.cos(ang - tw2 * 0.38) + GCX, GR * Math.sin(ang - tw2 * 0.38) + GCY);
        ctx.lineTo(GR * Math.cos(ang + tw2 * 0.38) + GCX, GR * Math.sin(ang + tw2 * 0.38) + GCY);
        ctx.lineTo(Gr * Math.cos(ang + tw2 / 2) + GCX, Gr * Math.sin(ang + tw2 / 2) + GCY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // count dot
        const px2 = GCX + (GR + 10) * Math.cos(ang);
        const py2 = GCY + (GR + 10) * Math.sin(ang);
        ctx.beginPath();
        ctx.arc(px2, py2, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
      }

      // template box label
      ctx.save();
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      const tAng = step * toothIdx;
      const tx = GCX + GR * Math.cos(tAng) - 10;
      const ty = GCY + GR * Math.sin(tAng) - 10;
      ctx.strokeRect(tx, ty, 20, 20);
      ctx.setLineDash([]);
      ctx.restore();

      ctx.fillStyle = "#10b981";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(
        revealedCount < TEETH
          ? `匹配中… ${revealedCount}/${TEETH}`
          : `完成！齒數：${TEETH}`,
        4,
        H - 6
      );
    }

    if (animated) {
      animRef.current = requestAnimationFrame(animate);
    }
  }, [viz, animated]);

  useEffect(() => {
    frameRef.current = 0;
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={220}
      style={{
        borderRadius: 10,
        border: "1px solid #1e3a5f",
        display: "block",
      }}
    />
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// METHOD CARD
// ─────────────────────────────────────────────────────────────────────────────
function MethodCard({ m, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? "#1e293b" : "#0d1424",
        border: selected ? "1px solid #38bdf8" : "1px solid #1e293b",
        borderRadius: 10,
        padding: "10px 12px",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          width: 28, height: 28, borderRadius: "50%",
          background: m.tagColor + "22",
          border: `2px solid ${m.tagColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, color: m.tagColor, flexShrink: 0,
        }}
      >
        {m.id}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: selected ? "#e2e8f0" : "#94a3b8", lineHeight: 1.3 }}>
          {m.name}
        </div>
        <div style={{ fontSize: 10, color: "#475569" }}>{m.eng}</div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [selected, setSelected] = useState(METHODS[0]); // 預設「極座標展開 + 峰值偵測」（推薦）
  const [tab, setTab] = useState("concept");
  const [animating, setAnimating] = useState(true);

  const tabs = [
    { key: "concept", label: "📖 概念" },
    { key: "code",    label: "💻 程式碼" },
    { key: "compare", label: "📊 比較" },
  ];

  const scenarios = [
    "高精度量產檢測",
    "清晰邊緣、低噪音影像",
    "快速粗估、低對比影像",
    "週期性分析、研究用途",
    "已知齒形、小批量",
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060d1a",
      color: "#e2e8f0",
      fontFamily: "'Noto Sans TC','Segoe UI', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "14px 20px 12px",
        borderBottom: "1px solid #1e293b",
        background: "linear-gradient(135deg,#0a0f1e,#10162a)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 26 }}>⚙️</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>
                齒輪齒數計算
                <span style={{ marginLeft: 8, fontSize: 11, background: "#14532d", color: "#86efac", padding: "2px 8px", borderRadius: 99, fontWeight: 600, verticalAlign: "middle" }}>
                  傳統影像處理
                </span>
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>
                5 種方法 · 動態視覺化 · 完整 Python 程式碼
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right", lineHeight: 1.5 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>黃傑翔</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>國立雲林科技大學－電子工程系</div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── 左側方法列表 ── */}
        <div style={{
          width: 195,
          background: "#080e1c",
          borderRight: "1px solid #1e293b",
          padding: "10px 8px",
          overflowY: "auto",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 9, color: "#334155", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
            選擇偵測方法
          </div>
          {METHODS.map(m => (
            <div key={m.id} style={{ marginBottom: 6 }}>
              <MethodCard
                m={m}
                selected={selected.id === m.id}
                onClick={() => { setSelected(m); setTab("concept"); setAnimating(true); }}
              />
            </div>
          ))}

          {/* 場景說明 */}
          <div style={{ marginTop: 16, padding: "10px", background: "#0d1424", borderRadius: 8, border: "1px solid #1e293b" }}>
            <div style={{ fontSize: 9, color: "#38bdf8", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              測試場景
            </div>
            <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>
              單顆正齒輪<br />
              齒數 n：{TEETH}<br />
              外徑 R：{GR} px<br />
              齒根 r：{Gr} px
            </div>
          </div>
        </div>

        {/* ── 右側內容 ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* 方法標題 */}
          <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid #1e293b", background: "#0a1020" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: selected.tagColor + "22",
                border: `2px solid ${selected.tagColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 800, color: selected.tagColor,
              }}>
                {selected.id}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{selected.eng}</div>
              </div>
              <span style={{
                marginLeft: "auto",
                fontSize: 10, fontWeight: 700,
                background: selected.tagColor + "22",
                color: selected.tagColor,
                padding: "3px 10px", borderRadius: 99,
              }}>
                {selected.tag}
              </span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: "4px 12px", borderRadius: 6, border: "none",
                  cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: tab === t.key ? "#38bdf8" : "#1e293b",
                  color: tab === t.key ? "#0a1020" : "#64748b",
                  transition: "all 0.15s",
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 內容區 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

            {/* ── 概念分頁 ── */}
            {tab === "concept" && (
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                  <GearCanvas viz={selected.viz} animated={animating} key={selected.viz + "-" + animating} />
                  <button
                    onClick={() => setAnimating(a => !a)}
                    style={{
                      background: "#1e293b", border: "1px solid #334155",
                      color: "#94a3b8", borderRadius: 6, padding: "4px 14px",
                      fontSize: 11, cursor: "pointer",
                    }}
                  >
                    {animating ? "⏸ 暫停" : "▶ 播放"}
                  </button>
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.8, marginTop: 0 }}>
                    {selected.desc}
                  </p>

                  <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                    {[
                      { label: "難易度", value: selected.difficulty, color: "#ef4444" },
                      { label: "速度",   value: selected.speed,      color: "#f59e0b" },
                      { label: "精度",   value: selected.accuracy,   color: "#10b981" },
                    ].map(r => (
                      <div key={r.label}>
                        <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{r.label}</div>
                        <Stars value={r.value} color={r.color} />
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 9, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>執行步驟</div>
                    {selected.steps.map((step, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: "#38bdf8", color: "#0a1020",
                          fontSize: 10, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>{i + 1}</span>
                        <span style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.6, paddingTop: 2 }}>{step}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1, background: "#0d2018", border: "1px solid #14532d", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700, marginBottom: 6 }}>✓ 優點</div>
                      {selected.pros.map((p, i) => (
                        <div key={i} style={{ color: "#6ee7b7", fontSize: 11, marginBottom: 3 }}>• {p}</div>
                      ))}
                    </div>
                    <div style={{ flex: 1, background: "#1a0d0d", border: "1px solid #7f1d1d", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, marginBottom: 6 }}>✗ 缺點</div>
                      {selected.cons.map((c, i) => (
                        <div key={i} style={{ color: "#fca5a5", fontSize: 11, marginBottom: 3 }}>• {c}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 程式碼分頁 ── */}
            {tab === "code" && (
              <div>
                <div style={{ background: "#020817", borderRadius: 10, border: "1px solid #1e293b", overflow: "hidden" }}>
                  <div style={{ padding: "8px 14px", background: "#0d1117", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#475569" }}>
                      {selected.eng.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}.py
                    </span>
                  </div>
                  <pre style={{
                    margin: 0, padding: "16px 18px",
                    color: "#7dd3fc", fontSize: 12, lineHeight: 1.8,
                    overflowX: "auto",
                    fontFamily: "'Fira Code','Cascadia Code',monospace",
                    whiteSpace: "pre",
                  }}>
                    {selected.code}
                  </pre>
                </div>
                <div style={{ marginTop: 10, padding: "10px 14px", background: "#0f172a", borderRadius: 8, border: "1px solid #1e293b", fontSize: 11, color: "#64748b" }}>
                  💡 安裝依賴：<code style={{ color: "#7dd3fc" }}>pip install opencv-python numpy scipy matplotlib</code>
                </div>
              </div>
            )}

            {/* ── 比較分頁 ── */}
            {tab === "compare" && (
              <div>
                <div style={{ marginBottom: 12, fontSize: 13, color: "#94a3b8" }}>
                  5 種方法的綜合評比（點擊列名可切換方法）
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #1e293b" }}>
                        {["方法", "難易度", "速度", "精度", "適用場景"].map((h, i) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: i === 0 || i === 4 ? "left" : "center", color: ["#475569","#ef4444","#f59e0b","#10b981","#475569"][i], fontWeight: 700, fontSize: 10, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {METHODS.map((m, idx) => {
                        const isSel = m.id === selected.id;
                        return (
                          <tr key={m.id} onClick={() => { setSelected(m); setTab("concept"); }}
                            style={{ borderBottom: "1px solid #1e293b", background: isSel ? "#1a2035" : "transparent", cursor: "pointer" }}>
                            <td style={{ padding: "10px" }}>
                              <span style={{ fontWeight: isSel ? 700 : 400, color: isSel ? "#e2e8f0" : "#94a3b8" }}>{m.name}</span>
                              {isSel && <span style={{ marginLeft: 6, fontSize: 9, color: "#38bdf8" }}>← 目前</span>}
                            </td>
                            <td style={{ padding: "10px", textAlign: "center" }}><Stars value={m.difficulty} color="#ef4444" /></td>
                            <td style={{ padding: "10px", textAlign: "center" }}><Stars value={m.speed} color="#f59e0b" /></td>
                            <td style={{ padding: "10px", textAlign: "center" }}><Stars value={m.accuracy} color="#10b981" /></td>
                            <td style={{ padding: "10px", color: "#64748b", fontSize: 11 }}>{scenarios[idx]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 20, padding: "14px 16px", background: "#0d1424", borderRadius: 10, border: "1px solid #1e293b" }}>
                  <div style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, marginBottom: 10 }}>🗺 方法選擇決策流程</div>
                  {[
                    { q: "能準確找到齒輪圓心？",   yes: "→ 極座標展開 + 峰值偵測（最推薦）" },
                    { q: "輪廓清晰、低噪音？",     yes: "→ 輪廓凸性缺陷分析" },
                    { q: "需要快速粗估？",         yes: "→ 徑向剖面峰值" },
                    { q: "需要頻域 / 週期分析？",  yes: "→ Canny + FFT 頻率分析" },
                    { q: "已有已知齒形樣板？",     yes: "→ 模板齒形匹配" },
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#334155", fontSize: 11, minWidth: 18 }}>{i + 1}.</span>
                      <div>
                        <span style={{ color: "#94a3b8", fontSize: 12 }}>{item.q}</span>
                        <span style={{ color: "#10b981", fontSize: 11, marginLeft: 8 }}>{item.yes}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
