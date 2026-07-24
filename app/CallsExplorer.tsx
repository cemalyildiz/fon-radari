"use client";

import { useEffect, useMemo, useState } from "react";
import type { FundingCall, CallScope, CallStatus } from "./calls-data";

type Props = { calls: FundingCall[] };
type StatusFilter = "active" | CallStatus | "all";
type LiveFeed = {
  checkedAt?: string;
  calls?: { identifier: string; title: string; deadline: string; url: string }[];
  degraded?: boolean;
};

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

function realStatus(call: FundingCall, now: number): CallStatus {
  const open = new Date(call.openDate).getTime();
  const close = new Date(call.deadline).getTime();
  if (close < now) return "archived";
  if (open > now) return "upcoming";
  return "open";
}

function daysLeft(deadline: string, now: number) {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 86_400_000));
}

function statusLabel(status: CallStatus) {
  if (status === "open") return "Başvuruya açık";
  if (status === "upcoming") return "Yakında açılacak";
  return "Arşiv";
}

function Countdown({ call, now }: { call: FundingCall; now: number }) {
  const status = realStatus(call, now);
  if (status === "archived") return <span className="countdown archived">Süre sona erdi</span>;
  if (status === "upcoming") return <span className="countdown upcoming">Yakında</span>;
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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<FundingCall | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [liveFeed, setLiveFeed] = useState<LiveFeed>({});

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 60_000);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const load = () =>
      fetch(`${basePath}/live-calls.json`, { cache: "no-store" })
        .then((response) => response.json())
        .then(setLiveFeed)
        .catch(() => setLiveFeed({ degraded: true }));
    load();
    const refresh = window.setInterval(load, 3_600_000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  const normalizedCalls = useMemo(
    () => calls.map((call) => ({ ...call, status: realStatus(call, now) })),
    [calls, now],
  );
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

  const filtered = normalizedCalls
    .filter((call) => call.scope === scope)
    .filter((call) => {
      if (status === "active") return call.status !== "archived";
      if (status === "all") return true;
      return call.status === status;
    })
    .filter((call) => scale === "Tümü" || call.companyScale.includes(scale))
    .filter((call) => {
      const haystack = `${call.title} ${call.code} ${call.institutionShort} ${call.tags.join(" ")}`.toLocaleLowerCase(
        "tr-TR",
      );
      return haystack.includes(query.toLocaleLowerCase("tr-TR"));
    })
    .sort((a, b) => {
      if (a.status === "archived" && b.status !== "archived") return 1;
      if (a.status !== "archived" && b.status === "archived") return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
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
            Türkiye ve Avrupa’daki güncel fon çağrılarını; tarih, destek türü, bütçe,
            başvuru sahibi ve firma ölçeği bilgileriyle tek ekranda inceleyin.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#cagrilar">
              Açık çağrıları görüntüle <span>↓</span>
            </a>
            <div className="trust-note">
              <span>✓</span>
              <p>
                <b>Doğrulanmış bilgi</b>
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
              <small>doğrulanmış açık çağrı</small>
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
        <div><b>TÜBİTAK</b></div>
        <div><b>KOSGEB</b></div>
        <div><b>HORIZON</b> EUROPE</div>
        <div><b>LIFE</b> PROGRAMME</div>
        <div><b>EIC</b></div>
        <div><b>DIGITAL</b> EUROPE</div>
      </section>

      <section className="calls-section" id="cagrilar">
        <div className="section-heading">
          <div>
            <span className="kicker">FIRSATLARI KEŞFET</span>
            <h2>Güncel proje çağrıları</h2>
            <p>Firmanızın ölçeğine ve hedeflerine uyan destekleri karşılaştırın.</p>
          </div>
          <div className={`sync-chip ${liveFeed.degraded ? "degraded" : ""}`}>
            <span />
            <div>
              <b>{liveFeed.degraded ? "Kaynak bağlantısı bekleniyor" : "AB kaynağı senkronize"}</b>
              <small>
                {liveFeed.checkedAt
                  ? `Son kontrol: ${trDateTime.format(new Date(liveFeed.checkedAt))}`
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
              setScale("Tümü");
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
              setScale("Tümü");
            }}
          >
            <span className="tab-icon globe">◎</span>
            <span>
              <b>Uluslararası Projeler</b>
              <small>Horizon Europe, LIFE, EIC ve diğerleri</small>
            </span>
            <i>{internationalCount}</i>
          </button>
        </div>

        <div className="filters">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Çağrı adı, kodu, kurum veya konu ara…"
              aria-label="Çağrılarda ara"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Aramayı temizle">
                ×
              </button>
            )}
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
              <option value="active">Aktif ve yaklaşan</option>
              <option value="open">Başvuruya açık</option>
              <option value="upcoming">Yakında</option>
              <option value="archived">Arşiv</option>
              <option value="all">Tümü</option>
            </select>
          </label>
          <div className="result-count">
            <strong>{filtered.length}</strong>
            <span>çağrı gösteriliyor</span>
          </div>
        </div>

        <div className="call-grid">
          {filtered.map((call) => (
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
                  {statusLabel(call.status)}
                </span>
              </div>
              <h3>{call.title}</h3>
              <p className="card-summary">{call.summary}</p>
              <div className="tag-row">
                {call.tags.slice(0, 3).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <dl className="card-facts">
                <div>
                  <dt>Son başvuru</dt>
                  <dd>{trDate.format(new Date(call.deadline))}</dd>
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
                <button onClick={() => setSelected(call)}>
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
                onClick={() => {
                  setQuery("");
                  setScale("Tümü");
                  setStatus("active");
                }}
              >
                Filtreleri temizle
              </button>
            </div>
          )}
        </div>
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
            <p>Avrupa Komisyonu çağrıları resmî Funding & Tenders API’sinden saatlik ön taramaya alınır.</p>
          </article>
          <article>
            <span>02</span>
            <div className="process-icon">✓</div>
            <h3>Alan bazlı doğrulama</h3>
            <p>Tarih, destek şekli, başvuru sahibi ve ölçek bilgileri resmî çağrı metniyle eşleştirilir.</p>
          </article>
          <article>
            <span>03</span>
            <div className="process-icon">↻</div>
            <h3>Otomatik durum yönetimi</h3>
            <p>Açılış ve kapanış tarihlerine göre çağrı durumu otomatik değişir; süresi geçen kayıt arşive taşınır.</p>
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
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Detay penceresini kapat">
              ×
            </button>
            <div className="modal-header">
              <div className="institution-badge large">
                <span>{selected.institutionShort.slice(0, 2).toUpperCase()}</span>
                <div><b>{selected.institutionShort}</b><small>{selected.code}</small></div>
              </div>
              <span className={`status-badge ${selected.status}`}><i />{statusLabel(selected.status)}</span>
              <h2 id="detail-title">{selected.title}</h2>
              <p>{selected.summary}</p>
              <div className="modal-header-bottom">
                <Countdown call={selected} now={now} />
                <span>Son doğrulama: {trDateTime.format(new Date(selected.verifiedAt))}</span>
              </div>
            </div>

            <div className="modal-body">
              {selected.notice && <div className="notice"><b>Önemli not</b><p>{selected.notice}</p></div>}
              <div className="detail-facts">
                <article><span>Başvuru dönemi</span><b>{trDate.format(new Date(selected.openDate))} – {trDate.format(new Date(selected.deadline))}</b></article>
                <article><span>Destek miktarı</span><b>{selected.fundingAmount}</b></article>
                <article><span>Destek şekli</span><b>{selected.fundingType}</b></article>
                <article><span>Destek oranı</span><b>{selected.supportRate ?? "Çağrı dokümanına göre"}</b></article>
                <article><span>Başvuru sahibi</span><b>{selected.applicants}</b></article>
                <article><span>Firma / kuruluş ölçeği</span><b>{selected.companyScale.join(", ")}</b></article>
                <article><span>Azami süre</span><b>{selected.duration ?? "Çağrı dokümanına göre"}</b></article>
                <article><span>Yürüten kurum</span><b>{selected.institution}</b></article>
              </div>

              <div className="detail-columns">
                <div>
                  <h3>Çağrının hedefleri</h3>
                  <ul>{selected.objectives.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <h3>Öne çıkan uygun giderler</h3>
                  <ul>{selected.eligibleCosts.map((item) => <li key={item}>{item}</li>)}</ul>
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
