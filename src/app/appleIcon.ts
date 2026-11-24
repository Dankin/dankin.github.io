// 顶栏左上角的苹果小图标:程序画的线稿(不是 emoji),颜色随主题。
// 美术组做好 src/art 的苹果后,可在这里换成 drawApple;现在是自带的最小实现。
const cssVar = (name: string, fallback: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export function drawHandIcon(cv: HTMLCanvasElement): void {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const size = cv.clientWidth || 22;
  if (cv.width !== Math.round(size * dpr)) {
    cv.width = cv.height = Math.round(size * dpr);
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const u = cv.width / 24; // 24 格坐标系
  ctx.setTransform(u, 0, 0, u, 0, 0);
  ctx.clearRect(0, 0, 24, 24);
  const ink = cssVar('--ink', '#1d1a17');
  const red = cssVar('--red', '#d9342b');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // 果身:上宽下窄,顶部有凹口
  ctx.beginPath();
  ctx.moveTo(12, 8.2);
  ctx.bezierCurveTo(9.6, 6.2, 4.2, 6.9, 4.1, 12.6);
  ctx.bezierCurveTo(4, 17.6, 8, 21.6, 10.4, 21.2);
  ctx.bezierCurveTo(11.4, 21, 11.7, 20.7, 12, 20.7);
  ctx.bezierCurveTo(12.3, 20.7, 12.6, 21, 13.6, 21.2);
  ctx.bezierCurveTo(16, 21.6, 20, 17.6, 19.9, 12.6);
  ctx.bezierCurveTo(19.8, 6.9, 14.4, 6.2, 12, 8.2);
  ctx.closePath();
  ctx.fillStyle = red;
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 高光
  ctx.beginPath();
  ctx.moveTo(7.2, 12);
  ctx.quadraticCurveTo(7.4, 10.2, 8.8, 9.6);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // 梗
  ctx.beginPath();
  ctx.moveTo(12, 8.2);
  ctx.quadraticCurveTo(12.2, 5.6, 13.6, 3.6);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 叶
  ctx.beginPath();
  ctx.moveTo(13.2, 5.4);
  ctx.bezierCurveTo(14.6, 3.2, 17.4, 3.2, 18.4, 4.2);
  ctx.bezierCurveTo(17.6, 6.2, 15.2, 6.8, 13.2, 5.4);
  ctx.closePath();
  ctx.fillStyle = cssVar('--leaf', '#6aa84f');
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.1;
  ctx.stroke();
}
