import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/**
 * Banner shown above the chat panel when the AI microservice is not
 * yet connected. Stub for v1.1 — always shown until estruflow-ai-parser
 * integration is wired up.
 */
export default function AIConfigBanner() {
  const { t } = useTranslation();

  return (
    <div
      style={{
        background: 'var(--chat-surface-1)',
        borderBottom: '1px solid var(--chat-border)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: 'var(--chat-font-body)',
        fontSize: 13,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--chat-accent)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 16,
        }}
      >
        ⚙
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--chat-text-primary)' }}>
          {t('chat.config_banner_title', { defaultValue: 'AI provider not configured' })}
        </div>
        <div style={{ color: 'var(--chat-text-secondary)', marginTop: 2 }}>
          {t('chat.config_banner_desc', {
            defaultValue:
              'Add an API key (Anthropic / OpenAI / Gemini / OpenRouter / Mistral / Groq) to start chatting with your data.',
          })}
        </div>
      </div>
      <Link
        to="/settings"
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 'var(--chat-radius)',
          background: 'var(--chat-accent)',
          color: '#ffffff',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 12,
          whiteSpace: 'nowrap',
        }}
      >
        {t('chat.open_settings', { defaultValue: 'Open Settings' })}
      </Link>
    </div>
  );
}
