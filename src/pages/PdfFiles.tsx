import { useI18n } from "../i18n/context";
import { Skeleton } from "../components/shared/Skeleton";

export default function PdfFiles() {
  const { t } = useI18n();
  return (
    <div className="page-placeholder">
      <h2>{t("sidebar.nav.pdfFiles")}</h2>
      <Skeleton variant="card" height={200} />
      <div style={{ marginTop: 16 }}>
        <Skeleton variant="text" lines={4} />
      </div>
    </div>
  );
}
