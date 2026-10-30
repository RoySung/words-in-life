import { useState, useSyncExternalStore } from 'react';
import { Button, Tag } from '../design-system/components';
import { installApp, pwaStore } from '../pwa';

export function PwaSettings() {
  const { offline, ready, updateAvailable, installed, canInstall, failed } = useSyncExternalStore(pwaStore.subscribe, pwaStore.getSnapshot);
  const [error, setError] = useState('');
  return <section className="pwa-settings" aria-labelledby="pwa-heading">
    <div className="settings-title"><h2 id="pwa-heading">加入主畫面</h2><Tag tone={installed ? 'blue' : 'neutral'}>{installed ? '已安裝' : '隨時開啟'}</Tag></div>
    <p className="settings-intro">將 Words in Life 放在主畫面，用獨立視窗開啟，隨時翻閱生活中的單字。</p>
    {canInstall && !installed
      ? <Button onClick={() => { setError(''); void installApp().catch(() => setError('暫時無法開啟安裝視窗，請使用瀏覽器選單加入主畫面。')); }}>安裝 Words in Life</Button>
      : !installed && <p className="settings-help">iPhone／iPad：在 Safari 點「分享」，選擇「加入主畫面」。Android／電腦：在瀏覽器選單選擇「安裝應用程式」或「加入主畫面」（若瀏覽器支援）。</p>}
    {error && <p role="alert" className="settings-error">{error}</p>}
    <p className="settings-help" role="status">{failed ? '離線準備未完成，請確認允許網站儲存資料，連線後重新開啟。' : ready ? '已可離線開啟：收藏單字、照片與翻卡複習。' : '請保持連線，首次開啟時會準備離線使用的內容。'} AI 照片辨識與個人化任務生成需要網路；發音是否可離線使用取決於裝置語音。</p>
    {offline && <p className="settings-notice" role="status">目前離線，仍可查看收藏與翻卡複習。</p>}
    {updateAvailable && <p className="settings-notice" role="status">新版已準備好。請關閉所有 Words in Life 分頁與 App 視窗，再次開啟即可更新；收藏會保留。</p>}
  </section>;
}
