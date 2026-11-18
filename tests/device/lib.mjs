// 设备测试公共工具。
// 重要：src/debug/testApi.ts 的 uiButtons()/touchTargets() 用的是“世界相机”的换算，而 HUD 在 uiCam（zoom=L.z，1.0~1.9，围绕画布中心）上渲染，
// 所以 testApi 报告的 UI 位置/尺寸在手机上是错的（偏小 L.z 倍、坐标偏移）。这里按 uiCam 重新换算出“真实 CSS 像素”。
export async function uiTrue(s) {
  return s.page.evaluate(() => {
    const g = window.__game; const sc = g.scene.getScene('game'); const ui = sc.uiCam; const z = ui.zoom;
    const r = g.canvas.getBoundingClientRect(); const k = r.width / g.scale.gameSize.width;
    const cx = g.scale.gameSize.width / 2, cy = g.scale.gameSize.height / 2;
    return window.__qa.uiButtons().map((b) => {
      const gx0 = cx + (b.gx0 - cx) * z, gy0 = cy + (b.gy0 - cy) * z;
      return { qa: b.qa, label: b.label, depth: b.depth, z, gx0: b.gx0, gy0: b.gy0, gw: b.gw, gh: b.gh,
        x: r.left + (gx0 + b.gw * z / 2) * k, y: r.top + (gy0 + b.gh * z / 2) * k, cssW: +(b.gw * z * k).toFixed(1), cssH: +(b.gh * z * k).toFixed(1),
        left: r.left + gx0 * k, top: r.top + gy0 * k, right: r.left + (gx0 + b.gw * z) * k, bottom: r.top + (gy0 + b.gh * z) * k };
    });
  });
}
/** 标题屏：无存档=“点击任意处开始”；有存档=左“继续”右“新游戏”，最下面是“导入存档” */
export const titleButtons = (btns) => { const b = btns.filter((x) => x.depth >= 1001).sort((a, c) => a.gy0 - c.gy0); return b.length >= 3 ? b.slice(0, -1).sort((a, c) => a.x - c.x) : b.length === 2 ? b.sort((a, c) => a.x - c.x) : []; };

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 从标题屏进入游戏。mode: 'new'（无存档点任意处/有存档点“新游戏”）| 'continue'。用 uiCam 换算后的真实坐标，鼠标/触屏通用。 */
export async function startGame(s, mode = 'new') {
  const vp = s.page.viewportSize();
  for (let i = 0; i < 6 && !(await s.state()).started; i++) {
    const tb = titleButtons(await uiTrue(s));
    if (tb.length >= 2) { const pick = mode === 'continue' ? tb[0] : tb[tb.length - 1]; await s.mouseClick(pick.x, pick.y); }
    else await s.mouseClick(vp.width / 2, vp.height * 0.42);
    await _sleep(900);
  }
}

// 稳定的无头 GL 组合：legacy `--use-gl=swiftshader`（lib/session.mjs 默认）在宿主机高负载下约 2/3 概率 WebGL context lost（pageerror: Framebuffer Unsupported）；
// angle+swiftshader 稳定，但 Canvas2D 加速 + 大量 getImageData 回读使程序化纹理生成慢 ~20×（168s vs 9s），故再加 --disable-accelerated-2d-canvas。
export const STABLE_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--disable-accelerated-2d-canvas'];
