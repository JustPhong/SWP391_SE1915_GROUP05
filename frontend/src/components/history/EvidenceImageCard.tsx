import React, { useState } from 'react';

interface EvidenceImageCardProps {
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  onPreview?: (url: string, title: string) => void;
}

export const EvidenceImageCard: React.FC<EvidenceImageCardProps> = ({
  title,
  subtitle,
  imageUrl,
  onPreview,
}) => {
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  const hasImage = Boolean(imageUrl && imageUrl.trim());

  return (
    <div
      style={{
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minHeight: 180,
      }}
    >
      {/* Header with Title & Subtitle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1E3A5F' }}>{title}</span>
        {hasImage && !loadError && (
          <span
            style={{
              fontSize: '0.7rem',
              color: '#16A34A',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            ✓ Có ảnh
          </span>
        )}
      </div>

      {/* Image / Placeholder Container */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 140,
          background: '#F1F5F9',
          borderRadius: 8,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #CBD5E1',
        }}
      >
        {!hasImage ? (
          /* Placeholder when no image exists */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              color: '#94A3B8',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Không có ảnh</span>
          </div>
        ) : loadError ? (
          /* Error fallback when image fails to load */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              color: '#DC2626',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Không thể tải ảnh</span>
          </div>
        ) : (
          /* Image Thumbnail with zoom trigger */
          <div
            style={{
              width: '100%',
              height: '100%',
              cursor: onPreview ? 'pointer' : 'default',
              position: 'relative',
            }}
            onClick={() => onPreview && imageUrl && onPreview(imageUrl, title)}
          >
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#F1F5F9',
                  color: '#94A3B8',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  gap: 6,
                  zIndex: 1,
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" />
                </svg>
                <span>Đang tải ảnh...</span>
              </div>
            )}
            <img
              src={imageUrl!}
              alt={title}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setLoadError(true);
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                opacity: loading ? 0 : 1,
                transition: 'opacity 0.2s ease, transform 0.2s ease',
              }}
              onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            />
            {/* Click to zoom overlay badge */}
            <div
              style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                background: 'rgba(15, 23, 42, 0.65)',
                color: '#FFFFFF',
                borderRadius: 6,
                padding: '2px 6px',
                fontSize: '0.65rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                pointerEvents: 'none',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              Xem
            </div>
          </div>
        )}
      </div>

      {/* Optional Subtitle / Timestamp */}
      {subtitle && (
        <span style={{ fontSize: '0.7rem', color: '#64748B', fontStyle: 'italic' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
};
