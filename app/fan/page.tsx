'use client';

import { useState } from 'react';

type Gate = {
  id: string;
  name: string;
  angle_deg: number;
  lat: number | null;
  lng: number | null;
};

type Zone = {
  id: string;
  section_number: string;
  tier: string;
  section_index: number;
  nearest_gate_id: string;
  gate: Gate;
};

export default function FanPage() {
  const [sectionQuery, setSectionQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searchResult, setSearchResult] = useState<Zone | null>(null);

  const [browseMode, setBrowseMode] = useState(false);
  const [allZones, setAllZones] = useState<Zone[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionQuery.trim()) return;

    setSearchLoading(true);
    setSearchError(false);
    setSearchResult(null);
    setBrowseMode(false);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/zones/seat/${encodeURIComponent(sectionQuery.trim())}`);
      if (!res.ok) {
        throw new Error('Not found');
      }
      const data: Zone = await res.json();
      setSearchResult(data);
    } catch (err) {
      setSearchError(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleBrowse = async () => {
    if (!browseMode && allZones.length === 0) {
      setBrowseLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/zones`);
        if (res.ok) {
          const data: Zone[] = await res.json();
          setAllZones(data);
        }
      } catch (err) {
        console.error('Failed to fetch all zones', err);
      } finally {
        setBrowseLoading(false);
      }
    }
    setBrowseMode(!browseMode);
  };

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 2L2 10v12l14 8 14-8V10L16 2z" fill="url(#dg1)" />
              <path d="M16 8l-8 4.5v7L16 24l8-4.5v-7L16 8z" fill="rgba(255,255,255,0.15)" />
              <defs>
                <linearGradient id="dg1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>Find Your Seat</h1>
            <p style={styles.subtitle}>Locate your section and nearest gate</p>
          </div>
        </div>

        <form onSubmit={handleSearch} style={styles.form}>
          <input
            type="text"
            value={sectionQuery}
            onChange={(e) => setSectionQuery(e.target.value)}
            placeholder="Enter your section number, e.g. L01"
            style={styles.input}
          />
          <button type="submit" disabled={searchLoading} style={styles.submitButton}>
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {searchError && (
          <div style={styles.errorContainer}>
            <p style={styles.errorText}>
              We couldn't find that section — check the number and try again
            </p>
          </div>
        )}

        {searchResult && !browseMode && (
          <div style={styles.resultCard}>
            <h2 style={styles.resultTitle}>Section {searchResult.section_number}</h2>
            <div style={styles.resultDetails}>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Tier</span>
                <span style={styles.detailValue}>{searchResult.tier}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Nearest Gate</span>
                <span style={styles.detailValue}>{searchResult.gate?.name || 'Unknown'}</span>
              </div>
            </div>
          </div>
        )}

        <div style={styles.divider} />

        <button onClick={toggleBrowse} style={styles.browseButton}>
          {browseMode ? 'Hide all sections' : 'Browse all sections'}
        </button>

        {browseMode && (
          <div style={styles.browseContainer}>
            {browseLoading ? (
              <p style={styles.loadingText}>Loading sections...</p>
            ) : allZones.length > 0 ? (
              <div style={styles.list}>
                {allZones.map((zone) => (
                  <div key={zone.id} style={styles.listItem}>
                    <div>
                      <div style={styles.listSectionTitle}>Section {zone.section_number}</div>
                      <div style={styles.listTier}>{zone.tier}</div>
                    </div>
                    <div style={styles.listGate}>
                      Gate: {zone.gate?.name || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.loadingText}>No sections available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0f',
    backgroundImage:
      'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 70%)',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: '1.5rem',
  },
  card: {
    width: '100%',
    maxWidth: '480px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '2rem',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem',
  },
  logo: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: '14px',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 0.2rem',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: '#64748b',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#f1f5f9',
    fontSize: '0.95rem',
    outline: 'none',
  },
  submitButton: {
    width: '100%',
    padding: '0.75rem 1.5rem',
    background: '#6366f1',
    border: 'none',
    borderRadius: '10px',
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  errorContainer: {
    padding: '0.75rem 1rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '10px',
    marginBottom: '1.5rem',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: '0.875rem',
    margin: 0,
    textAlign: 'center',
  },
  resultCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  resultTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#f1f5f9',
    margin: '0 0 1rem 0',
  },
  resultDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  detailItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  detailLabel: {
    color: '#94a3b8',
    fontSize: '0.875rem',
  },
  detailValue: {
    color: '#f8fafc',
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.1)',
    margin: '1.5rem 0',
  },
  browseButton: {
    width: '100%',
    padding: '0.75rem 1.5rem',
    background: 'transparent',
    border: '1px solid rgba(99,102,241,0.5)',
    borderRadius: '10px',
    color: '#a5b4fc',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  browseContainer: {
    marginTop: '1.5rem',
  },
  loadingText: {
    color: '#64748b',
    fontSize: '0.875rem',
    textAlign: 'center',
    margin: 0,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '300px',
    overflowY: 'auto',
    paddingRight: '0.5rem',
  },
  listItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: '8px',
  },
  listSectionTitle: {
    color: '#f8fafc',
    fontSize: '0.9rem',
    fontWeight: 600,
    marginBottom: '0.2rem',
  },
  listTier: {
    color: '#64748b',
    fontSize: '0.75rem',
  },
  listGate: {
    color: '#a5b4fc',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
};
