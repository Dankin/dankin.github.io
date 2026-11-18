type Fn = (...a: any[]) => void;
class Bus {
  private m = new Map<string, Fn[]>();
  on(e: string, f: Fn) { (this.m.get(e) ?? this.m.set(e, []).get(e)!).push(f); }
  off(e: string) { this.m.delete(e); }
  emit(e: string, ...a: any[]) { this.m.get(e)?.slice().forEach((f) => f(...a)); }
  clear() { this.m.clear(); }
}
export const bus = new Bus();
