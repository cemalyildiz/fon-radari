"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FundingCall, CallScope, CallStatus } from "./calls-data";
import { mergeCalls, realStatus, matchesSector, matchesSearch, stale, validDate, validateFeed, fundingCategory, type LiveFeed } from "./call-utils";

type Props = { calls: FundingCall[] };
type StatusFilter = "active" | CallStatus | "all";

const trDate = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

const trDateTime = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

const formatDate = (date?: string, time = false) => validDate(date) ? (time ? trDateTime : trDate).format(new Date(date!)) : "Tarih doğrulanmalı";
function freshness(call: FundingCall, now: number) {
  if (call.verification === "metadata") return `${stale(call.sourceCheckedAt, now) ? "Kaynak verisi eski · " : ""}Otomatik aktarım · uygunluk kontrolü gerekli`;
  return stale(call.verifiedAt, now, 24 * 14) ? "Koşulların yeniden doğrulanması gerekiyor" : "Editoryal kayıt · başvuru öncesi kontrol edin";
}

function daysLeft(deadline: string, now: number) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 86_400_000));
}

function statusLabel(status: CallStatus) {
  if (status === "unknown") return "Durum doğrulanmalı";
  if (status === "open") return "Başvuruya açık";
  if (status === "upcoming") return "Yakında açılacak";
  return "Arşiv";
}

function Countdown({ call, now }: { call: FundingCall; now: number }) {
  const status = realStatus(call, now);
  if (call.recordType === "program") return <span className="countdown">Program rehberi</span>;
  if (status === "unknown") return <span className="countdown">Takvim doğrulanmalı</span>;
  if (status === "archived") return <span className="countdown archived">Süre sona erdi</span>;
  if (status === "upcoming") return <span className="countdown upcoming">Yakında</span>;
  if (call.applicationType === "continuous" || !call.deadline) {
    return <span className="countdown continuous"><strong>∞</strong> sürekli başvuru</span>;
  }
  const days = daysLeft(call.deadline, now);
  return (
    <span className={`countdown ${days <= 30 ? "urgent" : ""}`}>
      <strong>{days}</strong> gün kaldı
    </span>
  );
}

export default function CallsExplorer({ calls }: Props) {
  const [scope, setScope] = useState<CallScope>("national");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [scale, setScale] = useState("Tümü");
  const [theme, setTheme] = useState("Tümü");
  const [sector, setSector] = useState("Tümü");
  const [institution, setInstitution] = useState("Tümü");
  const [funding, setFunding] = useState("Tümü");
  const [recordType, setRecordType] = useState("Tümü");
  const [ttoRole, setTtoRole] = useState("Tümü");
  const [includeGeneral, setIncludeGeneral] = useState(true);
  const [deadlineWindow, setDeadlineWindow] = useState("Tümü");
  const [visibleCount, setVisibleCount] = useState(24);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const modalRef = useRef<HTMLElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [liveFeed, setLiveFeed] = useState<LiveFeed>({});

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    let disposed = false;
    const controller = new AbortController();
    const load = () =>
      fetch(`${basePath}/live-calls.json`, { cache: "no-store", signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error("Feed unavailable"); return response.json(); })
        .then(value => { if (!validateFeed(value)) throw new Error("Invalid feed"); if (!disposed) setLiveFeed(value); })
        .catch(() => { if (!disposed) setLiveFeed(previous => ({ ...previous, degraded: true })); });
    load();
    const refresh = window.setInterval(load, 3_600_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
      disposed = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => Array.from(modalRef.current?.querySelectorAll<HTMLElement>('a[href], button, input, select, [tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
      if (event.key === "Tab") {
        const items = focusable(); const first = items[0]; const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedId]);

  const normalizedCalls = useMemo(
    () => mergeCalls(calls, liveFeed, now),
    [calls, liveFeed, now],
  );
  const selected = normalizedCalls.find(call => call.id === selectedId) ?? null;
  const feedStale = stale(liveFeed.checkedAt, now);
  const institutionOptions = ["Tümü", ...Array.from(new Set(normalizedCalls.filter(c => c.scope === scope).map(c => c.institutionShort))).sort((a,b) => a.localeCompare(b, "tr"))];
  const fundingOptions = ["Tümü", ...Array.from(new Set(normalizedCalls.filter(c => c.scope === scope).map(fundingCategory)))];
  function resetFilters() {
    setTtoRole("Tümü");
    setQuery(""); setScale("Tümü"); setTheme("Tümü"); setSector("Tümü"); setInstitution("Tümü");
    setFunding("Tümü"); setStatus("active"); setRecordType("Tümü"); setDeadlineWindow("Tümü"); setIncludeGeneral(true); setVisibleCount(24);
  }
  const activeCount = normalizedCalls.filter((call) => call.status === "open").length;
  const internationalCount = normalizedCalls.filter(
    (call) => call.scope === "international" && call.status !== "archived",
  ).length;
  const scaleOptions = useMemo(
    () => [
      "Tümü",
      ...Array.from(
        new Set(
          normalizedCalls
            .filter((call) => call.scope === scope)
            .flatMap((call) => call.companyScale),
        ),
      ),
    ],
    [normalizedCalls, scope],
  );
  const themeOptions = useMemo(
    () => [
      "Tümü",
      ...Array.from(
        new Set(
          normalizedCalls
            .filter((call) => call.scope === scope)
            .flatMap((call) => call.themes ?? call.tags),
        ),
      ).sort((a, b) => a.localeCompare(b, "tr-TR")),
    ],
    [normalizedCalls, scope],
  );
  const sectorOptions = useMemo(
    () => [
      "Tümü",
      ...Array.from(
        new Set(
          normalizedCalls
            .filter((call) => call.scope === scope)
            .flatMap((call) => call.sectors ?? ["Sektörler Arası"]),
        ),
      ).sort((a, b) => a.localeCompare(b, "tr-TR")),
    ],
    [normalizedCalls, scope],
  );

  const filtered = normalizedCalls
    .filter((call) => call.scope === scope)
    .filter((call) => {
      if (status === "active") return call.status === "open" || call.status === "upcoming" || call.recordType === "program";
      if (status === "all") return true;
      return call.status === status;
    })
    .filter((call) => scale === "Tümü" || call.companyScale.includes(scale))
    .filter((call) => theme === "Tümü" || (call.themes ?? call.tags).includes(theme))
    .filter((call) => matchesSector(call, sector, includeGeneral))
    .filter((call) => institution === "Tümü" || call.institutionShort === institution)
    .filter((call) => funding === "Tümü" || fundingCategory(call) === funding)
    .filter((call) => recordType === "Tümü" || (call.recordType ?? "call") === recordType)
    .filter((call) => ttoRole === "Tümü" || (ttoRole === "TTO fırsatları" ? Boolean(call.ttoRole) : call.ttoRole === ttoRole))
    .filter((call) => deadlineWindow === "Tümü" || Boolean(call.deadline && Date.parse(call.deadline) > now && Date.parse(call.deadline) <= now + Number(deadlineWindow) * 86_400_000))
    .filter((call) => matchesSearch(call, query))
    .sort((a, b) => {
      if (a.status === "archived" && b.status !== "archived") return 1;
      if (a.status !== "archived" && b.status === "archived") return -1;
      const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
      const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
      return aDeadline - bDeadline;
    });

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Fon Radarı ana sayfa">
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <span>
            <b>Fon Radarı</b>
            <small>Ulusal & Uluslararası Projeler</small>
          </span>
        </a>
        <nav aria-label="Ana menü">
          <a href="#cagrilar">Çağrılar</a>
          <a href="#nasil-calisir">Nasıl çalışır?</a>
          <a href="#kaynaklar">Kaynaklar</a>
        </nav>
        <a className="header-cta" href="#cagrilar">
          Çağrıları keşfet <span aria-hidden="true">↘</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="pulse" />
            Resmî kaynaklardan güncel takip
          </div>
          <h1>
            Doğru projeyi,
            <br />
            <em>doğru zamanda</em> bulun.
          </h1>
          <p>
            Türkiye ve Avrupa’daki güncel sanayi fırsatlarını; sektör, dönüşüm teması,
            tarih, destek türü, bütçe ve firma ölçeği bilgileriyle tek ekranda inceleyin.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#cagrilar">
              Açık çağrıları görüntüle <span>↓</span>
            </a>
            <div className="trust-note">
              <span>✓</span>
              <p>
                <b>Kaynağı belirtilen bilgi</b>
                <small>Her kayıtta resmî kaynak bağlantısı</small>
              </p>
            </div>
          </div>
        </div>

        <div className="radar-card" aria-label="Aktif çağrı özeti">
          <div className="radar-top">
            <span>CANLI ÇAĞRI RADARI</span>
            <span className="live-dot">AKTİF</span>
          </div>
          <div className="radar-visual">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="sweep" />
            <span className="blip b1" />
            <span className="blip b2" />
            <span className="blip b3" />
            <div className="radar-number">
              <strong>{activeCount}</strong>
              <small>takvime göre açık kayıt</small>
            </div>
          </div>
          <div className="radar-stats">
            <span>
              <b>{normalizedCalls.filter((call) => call.scope === "national" && call.status === "open").length}</b>
              Ulusal
            </span>
            <span>
              <b>{internationalCount}</b>
              Uluslararası
            </span>
            <span>
              <b>1 saat</b>
              AB API kontrolü
            </span>
          </div>
        </div>
      </section>

      <section className="source-strip" aria-label="İzlenen kaynaklar">
        <span>İzlenen resmî kaynaklar</span>
        <div><b>SANAYİ</b> BAKANLIĞI</div>
        <div><b>TİCARET</b> BAKANLIĞI</div>
        <div><b>SSB</b></div>
        <div><b>TÜBİTAK</b></div>
        <div><b>KOSGEB</b></div>
        <div><b>HORIZON</b> EUROPE</div>
        <div><b>EUREKA</b></div>
        <div><b>EUROSTARS</b></div>
        <div><b>LIFE</b> PROGRAMME</div>
        <div><b>EIC</b></div>
      </section>

      <section className="calls-section" id="cagrilar">
        <div className="section-heading">
          <div>
            <span className="kicker">FIRSATLARI KEŞFET</span>
            <h2>Güncel sanayi çağrıları ve destekleri</h2>
            <p>Yeşil ve dijital dönüşüm dâhil tüm temalarda, sektörünüze uyan fırsatları karşılaştırın.</p>
          </div>
          <div className={`sync-chip ${liveFeed.degraded || feedStale ? "degraded" : ""}`} role="status">
            <span />
            <div>
              <b>{liveFeed.degraded ? "AB yenilemesi başarısız · son veri korunuyor" : !liveFeed.checkedAt ? "AB verisi yükleniyor" : feedStale ? "AB verisi eski · yeniden kontrol gerekli" : "AB başlık ve takvim verisi alındı"}</b>
              <small>
                {liveFeed.checkedAt
                  ? `Son başarılı aktarım: ${formatDate(liveFeed.checkedAt, true)}`
                  : "Resmî API kontrol ediliyor…"}
              </small>
            </div>
          </div>
        </div>

        <div className="scope-tabs" role="tablist" aria-label="Çağrı kapsamı">
          <button
            role="tab"
            aria-selected={scope === "national"}
            className={scope === "national" ? "active" : ""}
            onClick={() => {
              setScope("national");
              resetFilters();
            }}
          >
            <span className="tab-icon">TR</span>
            <span>
              <b>Ulusal Projeler</b>
              <small>TÜBİTAK, KOSGEB ve diğerleri</small>
            </span>
            <i>{normalizedCalls.filter((call) => call.scope === "national" && call.status !== "archived").length}</i>
          </button>
          <button
            role="tab"
            aria-selected={scope === "international"}
            className={scope === "international" ? "active" : ""}
            onClick={() => {
              setScope("international");
              resetFilters();
            }}
          >
            <span className="tab-icon globe">◎</span>
            <span>
              <b>Uluslararası Projeler</b>
              <small>Horizon Europe, EUREKA, Eurostars ve diğerleri</small>
            </span>
            <i>{internationalCount}</i>
          </button>
        </div>

        <p className="data-notice">Otomatik AB aktarımı, destek koşullarının doğrulandığı anlamına gelmez. Diğer kurum kayıtları editoryal olarak güncellenir. Tema etiketleri keşif amaçlıdır; başvuru uygunluğu garantisi değildir.</p>
        <div className="filters" onChange={() => setVisibleCount(24)}>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Çağrı, kurum, sektör veya konsept ara…"
              aria-label="Çağrılarda ara"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Aramayı temizle">
                ×
              </button>
            )}
          </label>
          <label>
            <span>Tema / konsept</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value)}>
              {themeOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Sektör</span>
            <select value={sector} onChange={(event) => setSector(event.target.value)}>
              {sectorOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Firma ölçeği</span>
            <select value={scale} onChange={(event) => setScale(event.target.value)}>
              {scaleOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Durum</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
              <option value="active">Aktif, yaklaşan ve rehber</option>
              <option value="open">Başvuruya açık</option>
              <option value="upcoming">Yakında</option>
              <option value="archived">Arşiv</option>
              <option value="unknown">Durumu doğrulanmalı</option>
              <option value="all">Tümü</option>
            </select>
          </label>
          <label><span>Kurum</span><select value={institution} onChange={e => setInstitution(e.target.value)}>{institutionOptions.map(o => <option key={o}>{o}</option>)}</select></label>
          <label><span>Destek türü</span><select value={funding} onChange={e => setFunding(e.target.value)}>{fundingOptions.map(o => <option key={o}>{o}</option>)}</select></label>
          <label><span>Kayıt türü</span><select value={recordType} onChange={e => setRecordType(e.target.value)}><option>Tümü</option><option value="call">Çağrı / sürekli destek</option><option value="program">Program rehberi</option></select></label>
          <label><span>Son başvuru aralığı</span><select value={deadlineWindow} onChange={e => setDeadlineWindow(e.target.value)}><option>Tümü</option><option value="7">Önümüzdeki 7 gün</option><option value="30">Önümüzdeki 30 gün</option><option value="90">Önümüzdeki 90 gün</option></select></label>
          <label className="general-check"><input type="checkbox" checked={includeGeneral} onChange={e => setIncludeGeneral(e.target.checked)} /> Genel sektörlü destekleri de göster</label>
          <label><span>TTO katılımı</span><select value={ttoRole} onChange={e => setTtoRole(e.target.value)}>{["Tümü", "TTO fırsatları", "Doğrudan başvuru", "Üniversite adına başvuru", "Konsorsiyum ortağı", "Hizmet sağlayıcı"].map(role => <option key={role}>{role}</option>)}</select></label>
          <button className="reset-button" onClick={resetFilters}>Filtreleri temizle</button>
          <div className="result-count" aria-live="polite">
            <strong>{filtered.length}</strong>
            <span>çağrı gösteriliyor</span>
          </div>
        </div>

        <div className="call-grid">
          {filtered.slice(0, visibleCount).map((call) => (
            <article className={`call-card ${call.featured ? "featured" : ""}`} key={call.id}>
              {call.featured && <span className="featured-label">ÖNE ÇIKAN</span>}
              <div className="call-card-top">
                <div className="institution-badge">
                  <span>{call.institutionShort.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <b>{call.institutionShort}</b>
                    <small>{call.code}</small>
                  </div>
                </div>
                <span className={`status-badge ${call.status}`}>
                  <i />
                  {call.recordType === "program" ? "Program rehberi" : statusLabel(call.status)}
                </span>
              </div>
              <h3>{call.title}</h3>
              {call.ttoRole && <p className="verification-note">TTO: {call.ttoRole}</p>}
              <p className="card-summary">{call.summary}</p>
              <p className="verification-note">{freshness(call, now)}</p>
              <div className="tag-row">
                {Array.from(new Set([
                  ...(call.themes ?? call.tags).slice(0, 2),
                  ...(call.sectors ?? ["Sektörler Arası"]).slice(0, 2),
                ])).map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <dl className="card-facts">
                <div>
                  <dt>Son başvuru</dt>
                  <dd>{call.recordType === "program" ? "Alt çağrıya göre" : call.applicationType === "continuous" ? "Sürekli başvuru" : formatDate(call.deadline)}</dd>
                </div>
                <div>
                  <dt>Destek türü</dt>
                  <dd>{call.fundingType}</dd>
                </div>
                <div>
                  <dt>Firma ölçeği</dt>
                  <dd>{call.companyScale.slice(0, 2).join(", ")}</dd>
                </div>
              </dl>
              <div className="card-bottom">
                <Countdown call={call} now={now} />
                <button onClick={() => setSelectedId(call.id)}>
                  Detayları incele <span>→</span>
                </button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <span>⌕</span>
              <h3>Bu filtrelerle eşleşen çağrı bulunamadı.</h3>
              <p>Arama kelimesini veya filtreleri değiştirerek tekrar deneyin.</p>
              <button
                onClick={resetFilters}
              >
                Filtreleri temizle
              </button>
            </div>
          )}
        </div>
        {filtered.length > visibleCount && <button className="load-more" onClick={() => setVisibleCount(n => n + 24)}>Daha fazla göster ({visibleCount} / {filtered.length})</button>}
      </section>

      <section className="process-section" id="nasil-calisir">
        <div className="section-heading light">
          <div>
            <span className="kicker">GÜVENİLİR VERİ AKIŞI</span>
            <h2>Bilgi nasıl güncel tutuluyor?</h2>
          </div>
        </div>
        <div className="process-grid">
          <article>
            <span>01</span>
            <div className="process-icon">⌁</div>
            <h3>Resmî kaynak taraması</h3>
            <p>AB başlık ve takvim verisi saatlik planlanan işlemle alınır ve siteyle birlikte yayımlanır. Çalışma zamanları gecikebilir. Diğer kaynaklar editoryal olarak güncellenir.</p>
          </article>
          <article>
            <span>02</span>
            <div className="process-icon">✓</div>
            <h3>Alan bazlı doğrulama</h3>
            <p>Otomatik kayıtlar ile editoryal özetler ayrılır. Kontrol tarihi eski olan kayıtlar uyarılır; bütçe ve uygunluk için resmî metin esas alınır.</p>
          </article>
          <article>
            <span>03</span>
            <div className="process-icon">↻</div>
            <h3>Otomatik durum yönetimi</h3>
            <p>Bilinen son tarihler geçince çağrı arşivlenir. Çok dönemli çağrılarda sıradaki tarih seçilir. Belirsiz tarihler açık başvuru olarak kabul edilmez.</p>
          </article>
          <article>
            <span>04</span>
            <div className="process-icon">↗</div>
            <h3>Kaynağa doğrudan erişim</h3>
            <p>Her kayıttaki bağlantı kullanıcıyı ilgili kurumun güncel ve bağlayıcı çağrı sayfasına götürür.</p>
          </article>
        </div>
      </section>

      <section className="integrity-section" id="kaynaklar">
        <div>
          <span className="kicker">ŞEFFAFLIK İLKESİ</span>
          <h2>Kararınızı özet bilgiye değil, resmî çağrı metnine dayandırın.</h2>
        </div>
        <p>
          Fon Radarı fırsat keşfini hızlandırır. Başvuru öncesinde bütçe, uygunluk, ortaklık ve
          son tarih koşullarının bağlantısı verilen resmî dokümandan tekrar kontrol edilmesi gerekir.
        </p>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span><b>Fon Radarı</b><small>Güncel proje çağrıları</small></span>
        </a>
        <p>Ulusal ve uluslararası fon fırsatlarını güvenilir kaynaklardan takip edin.</p>
        <a href="#top">Yukarı dön ↑</a>
      </footer>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedId(null)}>
          <section
            className="detail-modal"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelectedId(null)} aria-label="Detay penceresini kapat">
              ×
            </button>
            <div className="modal-header">
              <div className="institution-badge large">
                <span>{selected.institutionShort.slice(0, 2).toUpperCase()}</span>
                <div><b>{selected.institutionShort}</b><small>{selected.code}</small></div>
              </div>
              <span className={`status-badge ${selected.status}`}><i />{selected.recordType === "program" ? "Program rehberi" : statusLabel(selected.status)}</span>
              <h2 id="detail-title">{selected.title}</h2>
              <p>{selected.summary}</p>
              <div className="modal-header-bottom">
                <Countdown call={selected} now={now} />
                <span>{selected.verification === "metadata" ? `Kaynak aktarımı: ${formatDate(selected.sourceCheckedAt, true)}` : `Editoryal kontrol: ${formatDate(selected.verifiedAt, true)}`}</span>
              </div>
            </div>

            <div className="modal-body">
              {selected.ttoRole && <div className="notice"><b>TTO: {selected.ttoRole}</b><p>{selected.ttoEligibility}</p></div>}
              <div className="notice"><b>Veri durumu</b><p>{freshness(selected, now)}. Türkiye’den başvuru, firma ölçeği ve ortaklık koşullarını resmî kaynaktan teyit edin.</p></div>
              {selected.notice && <div className="notice"><b>Önemli not</b><p>{selected.notice}</p></div>}
              <div className="detail-facts">
                <article><span>Başvuru dönemi · Türkiye saati</span><b>{selected.recordType === "program" ? "Program rehberi — alt çağrının takvimini kontrol edin" : selected.applicationType === "continuous" ? "Sürekli başvuru — güncel kabul durumunu teyit edin" : `${formatDate(selected.openDate, true)} – ${formatDate(selected.deadline, true)}`}</b></article>
                <article><span>Destek miktarı</span><b>{selected.fundingAmount}</b></article>
                <article><span>Destek şekli</span><b>{selected.fundingType}</b></article>
                <article><span>Destek oranı</span><b>{selected.supportRate ?? "Çağrı dokümanına göre"}</b></article>
                <article><span>Başvuru sahibi</span><b>{selected.applicants}</b></article>
                <article><span>Firma / kuruluş ölçeği</span><b>{selected.companyScale.join(", ")}</b></article>
                <article><span>Azami süre</span><b>{selected.duration ?? "Çağrı dokümanına göre"}</b></article>
                <article><span>Yürüten kurum</span><b>{selected.institution}</b></article>
                <article><span>Tema / konsept</span><b>{(selected.themes ?? selected.tags).join(", ")}</b></article>
                <article><span>Sektörler</span><b>{(selected.sectors ?? ["Sektörler Arası"]).join(", ")}</b></article>
              </div>
              {(selected.preDeadline || selected.deadlines?.length || selected.dateCheckedAt) && <div className="application-note"><span>Başvuru takvimi · Türkiye saati</span>
                {selected.preDeadline && <p>Ön kayıt / ek ulusal işlem: {formatDate(selected.preDeadline, true)} — aşamanın açıklaması için önemli notları inceleyin.</p>}
                {selected.deadlines?.map(date => <p key={date}>{formatDate(date, true)} {Date.parse(date) <= now ? "(geçti)" : ""}</p>)}
                {selected.dateCheckedAt && <p>Takvim son kontrolü: {formatDate(selected.dateCheckedAt)}</p>}
              </div>}

              <div className="detail-columns">
                <div>
                  <h3>Çağrının hedefleri</h3>
                  {selected.objectives.length ? <ul>{selected.objectives.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Resmî çağrı metninden kontrol edilmeli.</p>}
                </div>
                <div>
                  <h3>Öne çıkan uygun giderler</h3>
                  {selected.eligibleCosts.length ? <ul>{selected.eligibleCosts.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Resmî çağrı metninden kontrol edilmeli.</p>}
                </div>
              </div>
              <div className="application-note">
                <span>Başvuru yöntemi</span>
                <p>{selected.application}</p>
              </div>
            </div>
            <div className="modal-footer">
              <div>
                <span>Kaynak</span>
                <b>{selected.sourceLabel}</b>
              </div>
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                Resmî çağrı sayfasını aç <span>↗</span>
              </a>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
