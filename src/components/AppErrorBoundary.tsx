import { Component, type ReactNode } from 'react';
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main><h1>畫面暫時無法載入</h1><p role="alert">請重新載入再試一次，已儲存的資料會保留。</p><button onClick={() => window.location.reload()}>重新載入</button></main>;
    return this.props.children;
  }
}
