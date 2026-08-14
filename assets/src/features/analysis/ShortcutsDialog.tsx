import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowIcon from '@/components/ArrowIcon';
import { useScrollLock } from '@/lib/useScrollLock';

/** Arrow hints as icons — the mono font's subset has no ←/→ glyphs. */
function KeyGlyph({ k }: { k: string }) {
  if (k === '←') {
    return <ArrowIcon of="left" className="h-3 w-3" />;
  }
  if (k === '→') {
    return <ArrowIcon of="right" className="h-3 w-3" />;
  }
  if (k === '↑') {
    return <ArrowIcon of="up" className="h-3 w-3" />;
  }
  if (k === '↓') {
    return <ArrowIcon of="down" className="h-3 w-3" />;
  }
  return <>{k}</>;
}

function KeyRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-ui text-muted">{action}</span>
      <span className="flex shrink-0 gap-1">
        {keys.map((key) => (
          <kbd key={key} className="inline-flex items-center">
            <KeyGlyph k={key} />
          </kbd>
        ))}
      </span>
    </div>
  );
}

/** Every keyboard shortcut, in a small modal opened from the ? button. */
export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  useScrollLock();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close; Esc closes too
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes too (see the keydown listener above)
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-void/75 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('analysis.shortcuts')}
        className="mt-24 w-full max-w-sm animate-pop rounded-dialog border border-line-strong bg-overlay shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9)]"
      >
        <div className="border-b border-line px-4 py-3">
          <h2 className="m-0 text-lead font-semibold">{t('analysis.shortcuts')}</h2>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div>
            <h3 className="m-0 mb-1 text-micro font-semibold uppercase tracking-[0.11em] text-faint">
              {t('analysis.shortcutsGlobalTitle')}
            </h3>
            <div className="flex flex-col divide-y divide-line">
              <KeyRow keys={['←', '→']} action={t('analysis.shortcutNav')} />
              <KeyRow keys={['Home', 'End']} action={t('analysis.shortcutJump')} />
              <KeyRow keys={['f']} action={t('analysis.shortcutFlip')} />
              <KeyRow keys={['c']} action={t('analysis.shortcutNote')} />
            </div>
          </div>
          <div>
            <h3 className="m-0 mb-1 text-micro font-semibold uppercase tracking-[0.11em] text-faint">
              {t('analysis.shortcutsBoardTitle')}
            </h3>
            <div className="flex flex-col divide-y divide-line">
              <KeyRow keys={['↑', '↓', '←', '→']} action={t('analysis.shortcutSquareNav')} />
              <KeyRow keys={['Enter', 'Space']} action={t('analysis.shortcutPlay')} />
              <KeyRow keys={['h']} action={t('analysis.shortcutHighlight')} />
              <KeyRow keys={['a', 'a']} action={t('analysis.shortcutArrow')} />
              <KeyRow keys={['1', '2', '3', '4']} action={t('analysis.shortcutColors')} />
              <KeyRow keys={['Esc']} action={t('analysis.shortcutCancel')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
