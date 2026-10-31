import { useId, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react';
import { Camera, Home, Images, LoaderCircle, Search, Volume2 } from 'lucide-react';
import './foundation.css';
import { PhotoImage, type PhotoImageProps } from '../hooks/usePhotoUrl';

const classes = (...values: (string | undefined | false)[]) => values.filter(Boolean).join(' ');
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean };
export function Button({ variant = 'primary', loading = false, disabled, children, className, ...props }: ButtonProps) {
  return <button type="button" {...props} className={classes('vs-button', `vs-button--${variant}`, className)} disabled={disabled || loading} aria-busy={loading || undefined}>{loading && <LoaderCircle className="vs-spin" aria-hidden="true" />}{children}</button>;
}
export function IconButton({ label, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" {...props} aria-label={label} className={classes('vs-icon-button', className)}>{children}</button>;
}
export function Chip({ selected = false, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type="button" {...props} className={classes('vs-chip', selected && 'is-selected', props.className)} aria-pressed={selected}>{children}</button>;
}
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' }) {
  return <span className={`vs-tag vs-tag--${tone}`}>{children}</span>;
}
export function SearchField({ label = '搜尋單字', error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const id = useId();
  return <div className="vs-field"><label className="vs-sr-only" htmlFor={id}>{label}</label><div className="vs-input-wrap"><Search aria-hidden="true" /><input {...props} id={id} type="search" aria-invalid={!!error} aria-describedby={error ? `${id}-error` : props['aria-describedby']} /></div>{error && <p id={`${id}-error`} className="vs-error">{error}</p>}</div>;
}
export function Progress({ value, label }: { value?: number; label: string }) {
  return <div className="vs-progress"><span>{label}</span><progress aria-label={label} max={100} value={value === undefined ? undefined : Math.min(100, Math.max(0, value))} /></div>;
}
export function Polaroid({ src, alt, children, taped = false, className, photo, urls, fallbackPhoto, fallbackSrc }: Pick<PhotoImageProps, 'src' | 'alt' | 'photo' | 'urls' | 'fallbackPhoto' | 'fallbackSrc'> & { children?: ReactNode; taped?: boolean; className?: string }) {
  return <figure className={classes('vs-polaroid', taped && 'vs-polaroid--taped', className)}><PhotoImage photo={photo} urls={urls} src={src} fallbackPhoto={fallbackPhoto} fallbackSrc={fallbackSrc} alt={alt} loading="lazy" />{children && <figcaption>{children}</figcaption>}</figure>;
}
export function PhotoMarker({ label, x, y, onClick, labelOffset }: { label: string; x: number; y: number; onClick: () => void; labelOffset?: { x: number; y: number } }) {
  return <button type="button" className={classes('vs-marker', x > 60 && 'vs-marker--left', !!labelOffset && 'vs-marker--positioned')} style={{ '--marker-x': `${x}%`, '--marker-y': `${y}%`, '--marker-label-x': `${labelOffset?.x ?? 0}px`, '--marker-label-y': `${labelOffset?.y ?? 0}px` } as CSSProperties} onClick={onClick} aria-label={`查看 ${label}`}><span className="vs-marker-dot" aria-hidden="true" /><span className="vs-marker-label" lang="en">{label}</span></button>;
}
export function WordRow({ image, word, translation, action, onSpeak }: { image: string; word: string; translation: string; action: ReactNode; onSpeak: () => void }) {
  return <div className="vs-word-row"><img src={image} alt="" loading="lazy" /><div><strong lang="en">{word}</strong><span>{translation}</span></div><IconButton label={`播放 ${word} 發音`} onClick={onSpeak}><Volume2 /></IconButton>{action}</div>;
}
export function ShutterButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="vs-shutter" aria-label="拍攝照片" onClick={onClick} disabled={disabled}><Camera aria-hidden="true" /></button>;
}
export type NavDestination = 'home' | 'camera' | 'collection';
export function BottomNav({ active, onNavigate }: { active: NavDestination; onNavigate: (destination: NavDestination) => void }) {
  return <nav className="vs-bottom-nav" aria-label="主要導覽"><IconButton label="首頁" aria-current={active === 'home' ? 'page' : undefined} onClick={() => onNavigate('home')}><Home /></IconButton><ShutterButton onClick={() => onNavigate('camera')} /><IconButton label="我的單字" aria-current={active === 'collection' ? 'page' : undefined} onClick={() => onNavigate('collection')}><Images /></IconButton></nav>;
}
