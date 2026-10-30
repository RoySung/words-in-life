import { PwaSettings } from './PwaSettings';
import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Button, IconButton, Tag } from '../design-system/components';

interface SettingsViewProps {
  apiKey: string;
  notice: string;
  onSave: (key: string) => void;
  onBack: () => void;
}

export function SettingsView({ apiKey, notice, onSave, onBack }: SettingsViewProps) {
  const [draft, setDraft] = useState(apiKey);
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const save = (clear = false) => {
    const key = clear ? '' : draft.trim();
    if (!clear && !key) { setError('請先輸入 Gemini API key。'); setMessage(''); return; }
    if (/\s/.test(key)) { setError('API key 不能含有空白或換行，請確認後重新貼上。'); setMessage(''); return; }
    try {
      onSave(key);
      setDraft(key);
      setVisible(false);
      setError('');
      setMessage(clear ? '已清除 API key。下次辨識照片前，請先設定。' : '已儲存 API key，可以返回首頁辨識照片。');
    } catch {
      setError('瀏覽器無法儲存設定，請允許網站儲存資料後再試一次。');
      setMessage('');
    }
  };
  return <div className="app-page settings-page">
    <header className="page-header"><IconButton label="返回首頁" onClick={onBack}><ArrowLeft /></IconButton><h1>設定</h1><span aria-hidden="true" className="settings-header-spacer" /></header>
    <main>
      <section aria-labelledby="gemini-heading">
        <div className="settings-title"><h2 id="gemini-heading">Gemini API key</h2><Tag tone={apiKey ? 'blue' : 'neutral'}>{apiKey ? '已設定' : '尚未設定'}</Tag></div>
        <p className="settings-intro">設定你的 API key，讓 Gemini 辨識生活照片，並依單字簿安排每日任務。</p>
        {!apiKey && <p className="settings-notice" role="status">{notice || '尚未設定 API key，請先設定才能辨識照片。範例照片仍可使用。'}</p>}
        <form onSubmit={event => { event.preventDefault(); save(); }}>
          <label htmlFor="gemini-api-key">API key</label>
          <div className="settings-key-field">
            <input id="gemini-api-key" type={visible ? 'text' : 'password'} value={draft} onChange={event => { setDraft(event.target.value); setError(''); setMessage(''); }} placeholder="貼上你的 Gemini API key" autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby={error ? 'key-help key-error' : 'key-help'} aria-invalid={!!error} />
            <IconButton type="button" label={visible ? '隱藏 API key' : '顯示 API key'} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff /> : <Eye />}</IconButton>
          </div>
          <p id="key-help" className="settings-help">Key 只儲存在這個瀏覽器；辨識時直接將照片與 key 傳給 Google。開啟今日尋寶時，會傳送日期、時區、單字與複習摘要以生成個人化任務，該請求不含照片。共用裝置使用完畢後，請清除 key。</p>
          {error && <p id="key-error" className="settings-error" role="alert">{error}</p>}
          <div className="settings-actions"><Button type="submit">儲存設定</Button><Button type="button" variant="secondary" disabled={!apiKey} onClick={() => save(true)}>清除 API key</Button></div>
          <p className="settings-feedback" role="status">{message}</p>
        </form>
      </section>
      <PwaSettings />
    </main>
  </div>;
}
