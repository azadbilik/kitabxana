'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export default function EditAuthorPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    nameAz: '',
    nameRu: '',
    nameEn: '',
    nameFa: '',
    type: 'POET',
    period: '',
    bornYear: '',
    bornYearApprox: false,
    diedYear: '',
    diedYearApprox: false,
    bornPlace: '',
    diedPlace: '',
    bioAz: '',
    bioRu: '',
    portraitUrl: '',
    status: 'DRAFT',
  });

  // Load author data by ID (admin endpoint, returns raw markdown bios)
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API}/authors/by-id/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (r.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/admin/login';
          return;
        }
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setForm({
          nameAz: data.nameAz ?? '',
          nameRu: data.nameRu ?? '',
          nameEn: data.nameEn ?? '',
          nameFa: data.nameFa ?? '',
          type: data.type ?? 'POET',
          period: data.period ?? '',
          bornYear: data.bornYear != null ? String(data.bornYear) : '',
          bornYearApprox: data.bornYearApprox ?? false,
          diedYear: data.diedYear != null ? String(data.diedYear) : '',
          diedYearApprox: data.diedYearApprox ?? false,
          bornPlace: data.bornPlace ?? '',
          diedPlace: data.diedPlace ?? '',
          bioAz: data.bioAz ?? '',
          bioRu: data.bioRu ?? '',
          portraitUrl: data.portraitUrl ?? '',
          status: data.status ?? 'DRAFT',
        });
        setLoading(false);
      })
      .catch(() => {
        alert('Müəllif tapılmadı');
        router.push('/admin/authors');
      });
  }, [id, router]);

  const update = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const save = async (status?: string) => {
    setSaving(true);
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Giriş tələb olunur.');
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      nameAz: form.nameAz,
      nameRu: form.nameRu || undefined,
      nameEn: form.nameEn || undefined,
      nameFa: form.nameFa || undefined,
      type: form.type,
      period: form.period || undefined,
      bornYear: form.bornYear ? Number(form.bornYear) : undefined,
      bornYearApprox: form.bornYearApprox,
      diedYear: form.diedYear ? Number(form.diedYear) : undefined,
      diedYearApprox: form.diedYearApprox,
      bornPlace: form.bornPlace || undefined,
      diedPlace: form.diedPlace || undefined,
      bioAz: form.bioAz || undefined,
      bioRu: form.bioRu || undefined,
      portraitUrl: form.portraitUrl || undefined,
    };
    if (status) payload.status = status;

    try {
      const res = await fetch(`${API}/authors/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/admin/authors');
      } else {
        const err = await res.json().catch(() => null);
        const msg = Array.isArray(err?.message) ? err.message.join(', ') : err?.message ?? 'Naməlum xəta';
        alert(`Xəta: ${msg}`);
        setSaving(false);
      }
    } catch {
      alert('Server ilə əlaqə yoxdur');
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save();
  };

  if (loading) return <div className="adm-loading">Yüklənir…</div>;

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="adm-page-header">
          <h1 className="adm-page-title">Müəllifi redaktə et</h1>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button type="button" className="adm-btn adm-btn-sec" onClick={() => router.push('/admin/authors')}>
              Ləğv et
            </button>
            {form.status !== 'PUBLISHED' && (
              <button type="button" className="adm-btn adm-btn-pom" disabled={saving} onClick={() => save('PUBLISHED')}>
                Yayımla
              </button>
            )}
            {form.status === 'PUBLISHED' && (
              <button type="button" className="adm-btn adm-btn-sec" disabled={saving} onClick={() => save('DRAFT')}>
                Qaralamaya qaytar
              </button>
            )}
            <button type="submit" className="adm-btn" disabled={saving}>
              {saving ? 'Saxlanılır…' : 'Yadda saxla'}
            </button>
          </div>
        </div>

        <div className="adm-editor-grid">
          <div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-1">Ad (AZ) *</label>
              <input id="adm-authors-id-1" className="adm-input" value={form.nameAz} onChange={(e) => update('nameAz', e.target.value)} required />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-2">Ad (RU)</label>
              <input id="adm-authors-id-2" className="adm-input" value={form.nameRu} onChange={(e) => update('nameRu', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-3">Ad (EN)</label>
              <input id="adm-authors-id-3" className="adm-input" value={form.nameEn} onChange={(e) => update('nameEn', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-4">Ad (FA)</label>
              <input id="adm-authors-id-4" className="adm-input" value={form.nameFa} onChange={(e) => update('nameFa', e.target.value)} dir="rtl" />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-5">Növ</label>
              <select id="adm-authors-id-5" className="adm-select" value={form.type} onChange={(e) => update('type', e.target.value)}>
                {['POET', 'WRITER', 'PLAYWRIGHT', 'PHILOSOPHER', 'FOLK'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-6">Dövr</label>
              <input id="adm-authors-id-6" className="adm-input" value={form.period} onChange={(e) => update('period', e.target.value)} placeholder="XII əsr" />
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label className="adm-label" htmlFor="adm-authors-id-7">Doğum ili</label>
                <input id="adm-authors-id-7" className="adm-input" type="number" value={form.bornYear} onChange={(e) => update('bornYear', e.target.value)} />
              </div>
              <div className="adm-field">
                <label className="adm-label" htmlFor="adm-authors-id-8">Vəfat ili</label>
                <input id="adm-authors-id-8" className="adm-input" type="number" value={form.diedYear} onChange={(e) => update('diedYear', e.target.value)} />
              </div>
            </div>
            <div className="adm-field" style={{ display: 'flex', gap: '1rem' }}>
              <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={form.bornYearApprox} onChange={(e) => update('bornYearApprox', e.target.checked)} />
                Təxmini doğum
              </label>
              <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="checkbox" checked={form.diedYearApprox} onChange={(e) => update('diedYearApprox', e.target.checked)} />
                Təxmini vəfat
              </label>
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-9">Doğum yeri</label>
              <input id="adm-authors-id-9" className="adm-input" value={form.bornPlace} onChange={(e) => update('bornPlace', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-10">Vəfat yeri</label>
              <input id="adm-authors-id-10" className="adm-input" value={form.diedPlace} onChange={(e) => update('diedPlace', e.target.value)} />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-11">Portret URL</label>
              <input id="adm-authors-id-11" className="adm-input" value={form.portraitUrl} onChange={(e) => update('portraitUrl', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-12">Bioqrafiya (AZ, Markdown)</label>
              <textarea id="adm-authors-id-12"
                className="adm-textarea"
                value={form.bioAz}
                onChange={(e) => update('bioAz', e.target.value)}
                style={{ minHeight: '250px' }}
              />
            </div>
            <div className="adm-field">
              <label className="adm-label" htmlFor="adm-authors-id-13">Bioqrafiya (RU, Markdown)</label>
              <textarea id="adm-authors-id-13"
                className="adm-textarea"
                value={form.bioRu}
                onChange={(e) => update('bioRu', e.target.value)}
                style={{ minHeight: '250px' }}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
