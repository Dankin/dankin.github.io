/**
 * 程序化纹理会大量 getImageData/putImageData 回读。GPU 加速的 Canvas2D 下每次回读都会 GPU stall
 * （SwiftShader 下 853 张纹理 168s，软件画布 9s）。这里统一让所有 2D 画布默认走软件画布
 * (willReadFrequently)，覆盖 art/* 下所有 getContext('2d') 入口。必须在其它模块之前 import。
 */
const proto = HTMLCanvasElement.prototype as any;
const orig = proto.getContext as (this: HTMLCanvasElement, type: string, opts?: any) => any;
proto.getContext = function (this: HTMLCanvasElement, type: string, opts?: any) {
  if (type === '2d') opts = { willReadFrequently: true, ...(opts || {}) };
  return orig.call(this, type, opts);
};
export {};
