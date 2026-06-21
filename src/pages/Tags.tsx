import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import * as dbService from "../services/dbService";
import type { ImageRecord, TagInfo } from "../services/types";

const TAG_COLORS = [
  "#4a9eff", "#ff6b6b", "#51cf66", "#ffd43b", "#cc5de8",
  "#ff922b", "#20c997", "#f06595", "#748ffc", "#38d9a9",
];

async function openFile(filePath: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(filePath);
  } catch { /* silent */ }
}

function fileToUrl(filePath: string): string {
  return `asset://localhost/${encodeURI(filePath.replace(/\\/g, "/"))}`;
}

export default function Tags() {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<"cloud" | "list">("cloud");
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filteredImages, setFilteredImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  // Create/Edit dialog
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "rename">("create");
  const [dialogOldName, setDialogOldName] = useState("");
  const [dialogName, setDialogName] = useState("");
  const [dialogColor, setDialogColor] = useState(TAG_COLORS[0]);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Color picker per tag
  const [colorPickTag, setColorPickTag] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all images that have tags
      const rows = await dbService.query<{ tags: string }>(
        "SELECT tags FROM images WHERE tags IS NOT NULL AND tags != ''"
      );

      // Count tags
      const tagMap = new Map<string, number>();
      for (const row of rows) {
        const tagList = row.tags.split(",").map((t) => t.trim()).filter(Boolean);
        for (const tag of tagList) {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        }
      }

      const tagInfos: TagInfo[] = [];
      let i = 0;
      for (const [name, count] of tagMap) {
        // Check for saved color in settings
        tagInfos.push({
          name,
          count,
          color: TAG_COLORS[i % TAG_COLORS.length],
        });
        i++;
      }

      // Check for saved tag colors
      try {
        for (const ti of tagInfos) {
          const setting = await dbService.query<{ value: string }>(
            "SELECT value FROM settings WHERE key = ?",
            [`tag_color_${ti.name}`]
          );
          if (setting.length > 0) {
            ti.color = setting[0].value;
          }
        }
      } catch { /* use defaults */ }

      tagInfos.sort((a, b) => b.count - a.count);
      setTags(tagInfos);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const fetchFilteredImages = async (tag: string | null) => {
    setSelectedTag(tag);
    if (!tag) {
      setFilteredImages([]);
      return;
    }
    try {
      const rows = await dbService.query<ImageRecord>(
        "SELECT * FROM images WHERE tags LIKE ? ORDER BY indexed_at DESC LIMIT 100",
        [`%${tag}%`]
      );
      setFilteredImages(rows);
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    if (!dialogName.trim()) {
      setActionMsg(t("tags.tagNameRequired"));
      return;
    }
    try {
      // Save tag color preference
      await dbService.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [`tag_color_${dialogName.trim()}`, dialogColor]
      );
      setActionMsg(t("tags.tagCreated"));
      setShowDialog(false);
      setDialogName("");
      fetchTags();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRename = async () => {
    if (!dialogName.trim() || !dialogOldName) return;
    if (dialogName.trim() === dialogOldName) {
      setShowDialog(false);
      return;
    }
    try {
      // Rename tag on all images that have it
      const rows = await dbService.query<{ img_id: string; tags: string }>(
        "SELECT img_id, tags FROM images WHERE tags LIKE ?",
        [`%${dialogOldName}%`]
      );
      for (const row of rows) {
        const tagList = row.tags.split(",").map((t) => t.trim());
        const idx = tagList.indexOf(dialogOldName);
        if (idx >= 0) {
          tagList[idx] = dialogName.trim();
          await dbService.execute(
            "UPDATE images SET tags = ? WHERE img_id = ?",
            [tagList.join(", "), row.img_id]
          );
        }
      }
      // Update tag color setting
      const oldColor = await dbService.query<{ value: string }>(
        "SELECT value FROM settings WHERE key = ?",
        [`tag_color_${dialogOldName}`]
      );
      if (oldColor.length > 0) {
        await dbService.execute("DELETE FROM settings WHERE key = ?", [`tag_color_${dialogOldName}`]);
        await dbService.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          [`tag_color_${dialogName.trim()}`, oldColor[0].value]
        );
      }
      setActionMsg(t("tags.tagUpdated"));
      setShowDialog(false);
      if (selectedTag === dialogOldName) setSelectedTag(dialogName.trim());
      fetchTags();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async (tagName: string) => {
    try {
      const rows = await dbService.query<{ img_id: string; tags: string }>(
        "SELECT img_id, tags FROM images WHERE tags LIKE ?",
        [`%${tagName}%`]
      );
      for (const row of rows) {
        const tagList = row.tags.split(",").map((t) => t.trim()).filter((t) => t !== tagName);
        await dbService.execute(
          "UPDATE images SET tags = ? WHERE img_id = ?",
          [tagList.join(", "), row.img_id]
        );
      }
      await dbService.execute("DELETE FROM settings WHERE key = ?", [`tag_color_${tagName}`]);
      setActionMsg(t("tags.tagDeleted"));
      setDeleteTarget(null);
      if (selectedTag === tagName) setSelectedTag(null);
      fetchTags();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleColorChange = async (tagName: string, color: string) => {
    try {
      await dbService.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        [`tag_color_${tagName}`, color]
      );
      setTags((prev) => prev.map((t) => t.name === tagName ? { ...t, color } : t));
      setColorPickTag(null);
    } catch { /* silent */ }
  };

  const getFontSize = (count: number, max: number): number => {
    if (max <= 1) return 1;
    return 0.8 + (count / max) * 1.4;
  };

  const maxCount = tags.length > 0 ? Math.max(...tags.map((t) => t.count)) : 1;

  return (
    <div className="tags-page">
      <h2 className="page-title">{t("tags.title")}</h2>

      {/* View toggle / Create */}
      <div className="tags-toolbar">
        <div className="tags-view-toggle">
          <button
            className={`tags-view-btn ${viewMode === "cloud" ? "active" : ""}`}
            onClick={() => setViewMode("cloud")}
          >
            {t("tags.viewCloud")}
          </button>
          <button
            className={`tags-view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            {t("tags.viewList")}
          </button>
        </div>
        <button
          className="tags-create-btn"
          onClick={() => {
            setDialogMode("create");
            setDialogName("");
            setDialogColor(TAG_COLORS[0]);
            setShowDialog(true);
          }}
        >
          {t("tags.createTag")}
        </button>
      </div>

      {actionMsg && <p className="il-batch-msg">{actionMsg}</p>}

      {error && (
        <div className="il-error">
          <p>{t("common.error")}: {error}</p>
          <button className="il-retry-btn" onClick={fetchTags}>{t("common.retry")}</button>
        </div>
      )}

      {loading && <div className="il-loading">{t("tags.loading")}</div>}

      {!loading && !error && tags.length === 0 && (
        <div className="il-empty">
          <p className="il-empty-icon">{t("tags.emptyIcon")}</p>
          <p className="il-empty-title">{t("tags.emptyTitle")}</p>
          <p className="il-empty-desc">{t("tags.emptyDesc")}</p>
        </div>
      )}

      {!loading && !error && tags.length > 0 && (
        <>
          {/* Tag Cloud */}
          {viewMode === "cloud" && (
            <div className="tags-cloud">
              {tags.map((tag) => (
                <span
                  key={tag.name}
                  className={`tags-cloud-item ${selectedTag === tag.name ? "selected" : ""}`}
                  style={{
                    fontSize: `${getFontSize(tag.count, maxCount)}rem`,
                    color: tag.color,
                    borderColor: tag.color,
                  }}
                  onClick={() => fetchFilteredImages(selectedTag === tag.name ? null : tag.name)}
                >
                  {tag.name}
                  <span className="tags-cloud-count">{tag.count}</span>
                </span>
              ))}
            </div>
          )}

          {/* Tag List */}
          {viewMode === "list" && (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("tags.tagName")}</th>
                    <th>{t("tags.tagColor")}</th>
                    <th>{t("imageLibrary.totalImages")}</th>
                    <th>{t("common.delete")}</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <tr
                      key={tag.name}
                      className={`data-row ${selectedTag === tag.name ? "selected-row" : ""}`}
                    >
                      <td
                        className="cell-filename"
                        style={{ cursor: "pointer" }}
                        onClick={() => fetchFilteredImages(selectedTag === tag.name ? null : tag.name)}
                      >
                        <span className="tags-dot" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </td>
                      <td>
                        <div className="tags-color-cell">
                          <span
                            className="tags-color-swatch"
                            style={{ backgroundColor: tag.color }}
                            onClick={() => setColorPickTag(colorPickTag === tag.name ? null : tag.name)}
                          />
                          {colorPickTag === tag.name && (
                            <div className="tags-color-picker">
                              {TAG_COLORS.map((c) => (
                                <span
                                  key={c}
                                  className={`tags-color-opt ${c === tag.color ? "selected" : ""}`}
                                  style={{ backgroundColor: c }}
                                  onClick={() => handleColorChange(tag.name, c)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{t("tags.imageCount", { count: String(tag.count) })}</td>
                      <td className="cell-actions">
                        <button
                          className="table-action-btn"
                          onClick={() => {
                            setDialogMode("rename");
                            setDialogOldName(tag.name);
                            setDialogName(tag.name);
                            setShowDialog(true);
                          }}
                        >
                          {t("tags.renameTag")}
                        </button>
                        <button
                          className="table-action-btn il-card-action-danger"
                          onClick={() => setDeleteTarget(tag.name)}
                        >
                          {t("common.delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Filtered images */}
          {selectedTag && filteredImages.length > 0 && (
            <div className="tags-filtered">
              <h3>{t("tags.filterByTag")}: {selectedTag} ({filteredImages.length})</h3>
              <div className="il-grid">
                {filteredImages.map((img) => (
                  <div key={img.img_id} className="il-card">
                    <div className="il-card-thumb">
                      <img
                        src={fileToUrl(img.file_path)}
                        alt={img.filename ?? img.img_id}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="il-card-info">
                      <p className="il-card-name">{img.filename || img.img_id}</p>
                    </div>
                    <div className="il-card-actions">
                      <button
                        className="il-card-action-btn"
                        onClick={(e) => { e.stopPropagation(); openFile(img.file_path); }}
                      >
                        {t("imageLibrary.open")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create/Rename Dialog */}
      {showDialog && (
        <div className="tags-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="tags-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{dialogMode === "create" ? t("tags.createTag") : t("tags.editTag")}</h3>
            <div className="tags-dialog-field">
              <label>{t("tags.tagName")}</label>
              <input
                type="text"
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") dialogMode === "create" ? handleCreate() : handleRename();
                }}
                autoFocus
              />
            </div>
            {dialogMode === "create" && (
              <div className="tags-dialog-field">
                <label>{t("tags.tagColor")}</label>
                <div className="tags-dialog-colors">
                  {TAG_COLORS.map((c) => (
                    <span
                      key={c}
                      className={`tags-color-opt ${c === dialogColor ? "selected" : ""}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setDialogColor(c)}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="tags-dialog-actions">
              <button className="il-batch-btn il-batch-btn-primary" onClick={dialogMode === "create" ? handleCreate : handleRename}>
                {dialogMode === "create" ? t("common.save") : t("tags.renameTag")}
              </button>
              <button className="il-batch-btn" onClick={() => setShowDialog(false)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="tags-dialog-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="tags-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{t("common.confirm")}</h3>
            <p>{t("tags.deleteTagConfirm", { name: deleteTarget })}</p>
            <div className="tags-dialog-actions">
              <button className="il-batch-btn il-batch-btn-danger" onClick={() => handleDelete(deleteTarget)}>
                {t("common.delete")}
              </button>
              <button className="il-batch-btn" onClick={() => setDeleteTarget(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
