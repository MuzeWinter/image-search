import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import * as dbService from "../services/dbService";
import * as matchService from "../services/matchService";
import type { MatchRecord, MatchStats, ImageRecord, ExcelRecord, CadFile, PdfFile } from "../services/types";

const PAGE_SIZE = 30;

type MatchView = "auto" | "suspected" | "unmatched";

function methodLabel(t: (key: string) => string, method: string | null): string {
  switch (method) {
    case "excel-reference": return t("matchManagement.methodExcelRef");
    case "filename-match": return t("matchManagement.methodFilename");
    case "same-folder": return t("matchManagement.methodSameFolder");
    case "ai-similar": return t("matchManagement.methodAiSimilar");
    case "manual-bind": return t("matchManagement.methodManualBind");
    default: return method || "-";
  }
}

function statusLabel(t: (key: string) => string, status: string): string {
  switch (status) {
    case "auto": return t("matchManagement.statusAuto");
    case "suspected": return t("matchManagement.statusSuspected");
    case "confirmed": return t("matchManagement.statusConfirmed");
    case "rejected": return t("matchManagement.statusRejected");
    default: return status;
  }
}

export default function MatchManagement() {
  const { t } = useI18n();
  const [view, setView] = useState<MatchView>("auto");
  const [page, setPage] = useState(0);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [unmatchedImages, setUnmatchedImages] = useState<ImageRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<MatchStats | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [showBind, setShowBind] = useState(false);
  const [bindImg, setBindImg] = useState("");
  const [bindExId, setBindExId] = useState("");
  const [bindCadId, setBindCadId] = useState("");
  const [bindPdfId, setBindPdfId] = useState("");
  const [bindSearchResults, setBindSearchResults] = useState<{
    images: ImageRecord[];
    excel: ExcelRecord[];
    cad: CadFile[];
    pdf: PdfFile[];
  }>({ images: [], excel: [], cad: [], pdf: [] });

  const fetchStats = useCallback(async () => {
    try {
      const s = await matchService.getStats();
      setStats(s);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === "unmatched") {
        const result = await matchService.listUnmatched(PAGE_SIZE, page * PAGE_SIZE);
        // Map image records to match-like view
        const imgs = result.items as unknown as ImageRecord[];
        setUnmatchedImages(imgs);
        setTotalCount(result.total);
      } else {
        const status = view === "auto" ? "auto" : "suspected";
        const result = await matchService.listByStatus(status, PAGE_SIZE, page * PAGE_SIZE);
        setMatches(result.items);
        setTotalCount(result.total);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [view, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = async (id: number) => {
    try {
      await matchService.confirm(id);
      setActionMsg(t("matchManagement.confirmSuccess"));
      fetchData();
      fetchStats();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleReject = async (id: number) => {
    try {
      await matchService.reject(id);
      setActionMsg(t("matchManagement.rejectSuccess"));
      fetchData();
      fetchStats();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const searchForBind = async (query: string, table: string) => {
    if (!query.trim()) return;
    try {
      let rows: unknown[] = [];
      switch (table) {
        case "images":
          rows = await dbService.query<ImageRecord>(
            "SELECT * FROM images WHERE img_id LIKE ? OR filename LIKE ? OR file_path LIKE ? LIMIT 20",
            [`%${query}%`, `%${query}%`, `%${query}%`]
          );
          setBindSearchResults((prev) => ({ ...prev, images: rows as ImageRecord[] }));
          break;
        case "excel":
          rows = await dbService.query<ExcelRecord>(
            "SELECT DISTINCT ex_id, file_path, filename, sheet_name FROM excel_records WHERE ex_id LIKE ? OR filename LIKE ? LIMIT 20",
            [`%${query}%`, `%${query}%`]
          );
          setBindSearchResults((prev) => ({ ...prev, excel: rows as ExcelRecord[] }));
          break;
        case "cad":
          rows = await dbService.query<CadFile>(
            "SELECT * FROM cad_files WHERE cad_id LIKE ? OR filename LIKE ? LIMIT 20",
            [`%${query}%`, `%${query}%`]
          );
          setBindSearchResults((prev) => ({ ...prev, cad: rows as CadFile[] }));
          break;
        case "pdf":
          rows = await dbService.query<PdfFile>(
            "SELECT * FROM pdf_files WHERE doc_id LIKE ? OR filename LIKE ? LIMIT 20",
            [`%${query}%`, `%${query}%`]
          );
          setBindSearchResults((prev) => ({ ...prev, pdf: rows as PdfFile[] }));
          break;
      }
    } catch { /* silent */ }
  };

  const handleBind = async () => {
    if (!bindImg) {
      setActionMsg(t("matchManagement.bindInstruction"));
      return;
    }
    if (!bindExId && !bindCadId && !bindPdfId) {
      setActionMsg(t("matchManagement.bindInstruction"));
      return;
    }
    try {
      setActionMsg(t("matchManagement.binding"));
      await matchService.bind({
        img_id: bindImg,
        ex_id: bindExId || undefined,
        cad_id: bindCadId || undefined,
        pdf_id: bindPdfId || undefined,
        method: "manual-bind",
        confidence: "1.0",
      });
      setActionMsg(t("matchManagement.bindSuccess"));
      setShowBind(false);
      setBindImg("");
      setBindExId("");
      setBindCadId("");
      setBindPdfId("");
      setBindSearchResults({ images: [], excel: [], cad: [], pdf: [] });
      fetchData();
      fetchStats();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="match-page">
      <h2 className="page-title">{t("matchManagement.title")}</h2>

      {/* Stats bar */}
      {stats && (
        <div className="match-stats-bar">
          <span className="match-stat">
            {t("matchManagement.statusAuto")}: <strong>{stats.auto}</strong>
          </span>
          <span className="match-stat">
            {t("matchManagement.statusSuspected")}: <strong>{stats.suspected}</strong>
          </span>
          <span className="match-stat">
            {t("matchManagement.statusConfirmed")}: <strong>{stats.confirmed}</strong>
          </span>
          <span className="match-stat">
            {t("matchManagement.statusRejected")}: <strong>{stats.rejected}</strong>
          </span>
          <span className="match-stat">
            {t("matchManagement.viewUnmatched")}: <strong>{stats.unmatched}</strong>
          </span>
        </div>
      )}

      {/* View tabs */}
      <div className="match-tabs">
        {(["auto", "suspected", "unmatched"] as MatchView[]).map((v) => (
          <button
            key={v}
            className={`match-tab ${view === v ? "active" : ""}`}
            onClick={() => { setView(v); setPage(0); }}
          >
            {v === "auto" ? t("matchManagement.viewAuto") :
             v === "suspected" ? t("matchManagement.viewSuspected") :
             t("matchManagement.viewUnmatched")}
          </button>
        ))}
        <button
          className="match-tab match-tab-bind"
          onClick={() => setShowBind(!showBind)}
        >
          {t("matchManagement.manualBind")}
        </button>
      </div>

      {actionMsg && <p className="il-batch-msg">{actionMsg}</p>}

      {/* Bind panel */}
      {showBind && (
        <div className="match-bind-panel">
          <h3>{t("matchManagement.bindTitle")}</h3>
          <div className="match-bind-fields">
            <div className="match-bind-field">
              <label>{t("matchManagement.bindSelectImg")}</label>
              <input
                type="text"
                placeholder="IMG-..."
                value={bindImg}
                onChange={(e) => { setBindImg(e.target.value); searchForBind(e.target.value, "images"); }}
              />
              {bindSearchResults.images.length > 0 && (
                <ul className="match-bind-results">
                  {bindSearchResults.images.map((img) => (
                    <li key={img.img_id} onClick={() => { setBindImg(img.img_id); setBindSearchResults((p) => ({ ...p, images: [] })); }}>
                      {img.img_id} - {img.filename || img.file_path}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="match-bind-field">
              <label>{t("matchManagement.bindSelectExcel")}</label>
              <input
                type="text"
                placeholder="EX-..."
                value={bindExId}
                onChange={(e) => { setBindExId(e.target.value); searchForBind(e.target.value, "excel"); }}
              />
              {bindSearchResults.excel.length > 0 && (
                <ul className="match-bind-results">
                  {bindSearchResults.excel.map((ex) => (
                    <li key={ex.ex_id} onClick={() => { setBindExId(ex.ex_id); setBindSearchResults((p) => ({ ...p, excel: [] })); }}>
                      {ex.ex_id} - {ex.filename}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="match-bind-field">
              <label>{t("matchManagement.bindSelectCad")}</label>
              <input
                type="text"
                placeholder="CAD-..."
                value={bindCadId}
                onChange={(e) => { setBindCadId(e.target.value); searchForBind(e.target.value, "cad"); }}
              />
              {bindSearchResults.cad.length > 0 && (
                <ul className="match-bind-results">
                  {bindSearchResults.cad.map((c) => (
                    <li key={c.cad_id} onClick={() => { setBindCadId(c.cad_id); setBindSearchResults((p) => ({ ...p, cad: [] })); }}>
                      {c.cad_id} - {c.filename}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="match-bind-field">
              <label>{t("matchManagement.bindSelectPdf")}</label>
              <input
                type="text"
                placeholder="DOC-..."
                value={bindPdfId}
                onChange={(e) => { setBindPdfId(e.target.value); searchForBind(e.target.value, "pdf"); }}
              />
              {bindSearchResults.pdf.length > 0 && (
                <ul className="match-bind-results">
                  {bindSearchResults.pdf.map((p) => (
                    <li key={p.doc_id} onClick={() => { setBindPdfId(p.doc_id); setBindSearchResults((p) => ({ ...p, pdf: [] })); }}>
                      {p.doc_id} - {p.filename}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="match-bind-actions">
            <button className="match-btn match-btn-confirm" onClick={handleBind}>
              {t("matchManagement.bind")}
            </button>
            <button className="match-btn" onClick={() => setShowBind(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="il-error">
          <p>{t("common.error")}: {error}</p>
          <button className="il-retry-btn" onClick={fetchData}>{t("common.retry")}</button>
        </div>
      )}

      {loading && <div className="il-loading">{t("matchManagement.loading")}</div>}

      {!loading && !error && totalCount === 0 && (
        <div className="il-empty">
          <p className="il-empty-icon">{t("matchManagement.emptyIcon")}</p>
          <p className="il-empty-title">{t("matchManagement.emptyTitle")}</p>
          <p className="il-empty-desc">{t("matchManagement.emptyDesc")}</p>
        </div>
      )}

      {!loading && !error && totalCount > 0 && (
        <>
          {view === "unmatched" ? (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("matchManagement.imgId")}</th>
                    <th>{t("cadFiles.filename")}</th>
                    <th>{t("cadFiles.path")}</th>
                    <th>{t("common.delete")}</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedImages.map((img) => (
                    <tr key={img.img_id} className="data-row">
                      <td className="cell-id">{img.img_id}</td>
                      <td className="cell-filename">{img.filename || "-"}</td>
                      <td className="cell-path" title={img.file_path}>{img.file_path}</td>
                      <td className="cell-actions">
                        <button
                          className="table-action-btn"
                          onClick={() => { setBindImg(img.img_id); setShowBind(true); }}
                        >
                          {t("matchManagement.manualBind")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("matchManagement.imgId")}</th>
                    <th>{t("matchManagement.exId")}/{t("matchManagement.cadId")}/{t("matchManagement.docId")}</th>
                    <th>{t("matchManagement.method")}</th>
                    <th>{t("matchManagement.confidence")}</th>
                    <th>{t("matchManagement.statusAuto")}</th>
                    <th>{t("common.delete")}</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => {
                    const associated = [
                      m.ex_id ? `EX: ${m.excel_filename || m.ex_id}` : null,
                      m.cad_id ? `CAD: ${m.cad_filename || m.cad_id}` : null,
                      m.pdf_id ? `PDF: ${m.pdf_filename || m.pdf_id}` : null,
                    ].filter(Boolean).join(" | ");
                    return (
                      <tr key={m.id} className="data-row">
                        <td className="cell-id">{m.img_filename || m.img_id}</td>
                        <td className="cell-filename" title={associated}>{associated || "-"}</td>
                        <td>{methodLabel(t, m.method)}</td>
                        <td>{m.confidence ?? "-"}</td>
                        <td><span className={`match-status-badge ${m.status}`}>{statusLabel(t, m.status)}</span></td>
                        <td className="cell-actions">
                          {m.status !== "confirmed" && (
                            <button className="match-btn match-btn-confirm" onClick={() => handleConfirm(m.id)}>
                              {t("matchManagement.confirm")}
                            </button>
                          )}
                          {m.status !== "rejected" && (
                            <button className="match-btn match-btn-reject" onClick={() => handleReject(m.id)}>
                              {t("matchManagement.reject")}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="il-pagination">
              <button className="il-page-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                {t("imageLibrary.prevPage")}
              </button>
              <span className="il-page-info">{page + 1} / {totalPages} ({totalCount} {t("imageLibrary.total")})</span>
              <button className="il-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                {t("imageLibrary.nextPage")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
