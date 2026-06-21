/* === Mock Data — ZOOBET检索 === */

const MOCK = {

libraries: [
  { id: 1, path: 'D:\\设计资料库\\产品设计', fileCount: 1243, lastScan: '2026-06-15 14:32', status: 'ready' },
  { id: 2, path: 'D:\\设计资料库\\客户参考', fileCount: 567, lastScan: '2026-06-14 09:15', status: 'ready' },
  { id: 3, path: 'E:\\项目档案\\2025', fileCount: 892, lastScan: '2026-06-10 16:48', status: 'scanning' },
],

imageAssets: [
  { imgId: 'IMG-000001', sourceType: 'excel-embedded', path: 'D:\\设计资料库\\产品设计\\产品清单.xlsx', folder: 'D:\\设计资料库\\产品设计', filename: 'excel_embedded_001.jpg', size: '245 KB', width: 1920, height: 1080, hash: 'a1b2c3d4', indexed: true, exRef: 'EX-000001', cadRef: 'CAD-000001', pdfRef: null, tags: ['老虎钳', '结构件'], notes: '', status: 'normal', lastModified: '2025-11-20' },
  { imgId: 'IMG-000002', sourceType: 'excel-embedded', path: 'D:\\设计资料库\\产品设计\\产品清单.xlsx', folder: 'D:\\设计资料库\\产品设计', filename: 'excel_embedded_002.jpg', size: '312 KB', width: 1920, height: 1080, hash: 'e5f6g7h8', indexed: true, exRef: 'EX-000001', cadRef: 'CAD-000001', pdfRef: null, tags: ['老虎钳', '外观方案'], notes: '第二张视图', status: 'normal', lastModified: '2025-11-20' },
  { imgId: 'IMG-000003', sourceType: 'standalone', path: 'D:\\设计资料库\\产品设计\\渲染图\\水泵钳_v3.jpg', folder: 'D:\\设计资料库\\产品设计\\渲染图', filename: '水泵钳_v3.jpg', size: '4.2 MB', width: 3840, height: 2160, hash: 'i9j0k1l2', indexed: true, exRef: null, cadRef: 'CAD-000003', pdfRef: null, tags: ['水泵钳', '渲染图', '最终版'], notes: '', status: 'normal', lastModified: '2026-01-15' },
  { imgId: 'IMG-000004', sourceType: 'standalone', path: 'D:\\设计资料库\\产品设计\\实物照片\\机油桶_样品.jpg', folder: 'D:\\设计资料库\\产品设计\\实物照片', filename: '机油桶_样品.jpg', size: '5.8 MB', width: 4032, height: 3024, hash: 'm3n4o5p6', indexed: true, exRef: 'EX-000005', cadRef: 'CAD-000008', pdfRef: null, tags: ['机油桶', '实物照片'], notes: '第一次打样', status: 'normal', lastModified: '2026-02-28' },
  { imgId: 'IMG-000005', sourceType: 'standalone', path: 'D:\\设计资料库\\产品设计\\草图\\手柄方案.jpg', folder: 'D:\\设计资料库\\产品设计\\草图', filename: '手柄方案.jpg', size: '1.1 MB', width: 2400, height: 1600, hash: 'q7r8s9t0', indexed: true, exRef: null, cadRef: 'CAD-000005', pdfRef: null, tags: ['工具手柄', '草图', '双色包胶'], notes: '', status: 'normal', lastModified: '2025-08-10' },
  { imgId: 'IMG-000006', sourceType: 'pdf-preview', path: 'D:\\设计资料库\\客户参考\\博世-冲击钻说明书.pdf', folder: 'D:\\设计资料库\\客户参考', filename: '博世-冲击钻说明书_preview.jpg', size: '180 KB', width: 1240, height: 1754, hash: 'u1v2w3x4', indexed: true, exRef: null, cadRef: null, pdfRef: 'DOC-000001', tags: ['参考图', '竞品分析'], notes: '', status: 'normal', lastModified: '2025-06-01' },
  { imgId: 'IMG-000007', sourceType: 'excel-embedded', path: 'D:\\设计资料库\\产品设计\\零件清单.xlsx', folder: 'D:\\设计资料库\\产品设计', filename: 'excel_embedded_003.jpg', size: '198 KB', width: 1600, height: 900, hash: 'y5z6a7b8', indexed: true, exRef: 'EX-000003', cadRef: 'CAD-000004', pdfRef: null, tags: ['洗衣液瓶', '外观方案'], notes: '', status: 'normal', lastModified: '2026-03-10' },
  { imgId: 'IMG-000008', sourceType: 'standalone', path: 'D:\\设计资料库\\产品设计\\渲染图\\音响_v2.jpg', folder: 'D:\\设计资料库\\产品设计\\渲染图', filename: '音响_v2.jpg', size: '3.5 MB', width: 3840, height: 2160, hash: 'c9d0e1f2', indexed: true, exRef: 'EX-000007', cadRef: 'CAD-000010', pdfRef: null, tags: ['音响', '渲染图'], notes: '', status: 'normal', lastModified: '2026-04-05' },
  { imgId: 'IMG-000009', sourceType: 'standalone', path: 'D:\\设计资料库\\客户参考\\客户提供\\手柄参考图.jpg', folder: 'D:\\设计资料库\\客户参考\\客户提供', filename: '手柄参考图.jpg', size: '2.1 MB', width: 3000, height: 2000, hash: 'g3h4i5j6', indexed: true, exRef: null, cadRef: null, pdfRef: null, tags: ['参考图', '客户确认', '工具手柄'], notes: '客户2025年12月提供', status: 'normal', lastModified: '2025-12-10' },
  { imgId: 'IMG-000010', sourceType: 'excel-embedded', path: 'D:\\设计资料库\\产品设计\\产品清单.xlsx', folder: 'D:\\设计资料库\\产品设计', filename: 'excel_embedded_004.jpg', size: '278 KB', width: 1920, height: 1080, hash: 'k7l8m9n0', indexed: false, exRef: 'EX-000002', cadRef: null, pdfRef: null, tags: [], notes: '待确认', status: 'pending', lastModified: '2026-05-20' },
  { imgId: 'IMG-000011', sourceType: 'standalone', path: 'D:\\设计资料库\\产品设计\\实物照片\\盖子样品_01.jpg', folder: 'D:\\设计资料库\\产品设计\\实物照片', filename: '盖子样品_01.jpg', size: '3.2 MB', width: 4032, height: 3024, hash: 'o1p2q3r4', indexed: true, exRef: null, cadRef: 'CAD-000012', pdfRef: null, tags: ['盖子', '实物照片', '结构件'], notes: '', status: 'normal', lastModified: '2026-05-12' },
],

excelRecords: [
  { exId: 'EX-000001', excelPath: 'D:\\设计资料库\\产品设计\\产品清单.xlsx', sheetName: '夹具类', row: 12, originalId: 'HQ-2024-001', name: '8寸老虎钳', customer: '得力工具', category: '夹具', notes: '双色包胶手柄，CR-V锻造', ugFile: 'tiger_clamp_8inch.prt', filePath: 'D:\\设计资料库\\产品设计\\UG\\tiger_clamp_8inch.prt', imageCount: 2, cadCount: 1, status: 'normal', lastScan: '2026-06-15' },
  { exId: 'EX-000002', excelPath: 'D:\\设计资料库\\产品设计\\产品清单.xlsx', sheetName: '夹具类', row: 18, originalId: 'HQ-2024-005', name: '6寸水泵钳', customer: '得力工具', category: '夹具', notes: '', ugFile: 'pump_clamp_6inch.prt', filePath: 'D:\\设计资料库\\产品设计\\UG\\pump_clamp_6inch.prt', imageCount: 1, cadCount: 1, status: 'normal', lastScan: '2026-06-15' },
  { exId: 'EX-000003', excelPath: 'D:\\设计资料库\\产品设计\\零件清单.xlsx', sheetName: '包装容器', row: 8, originalId: 'PKG-2025-012', name: '2L洗衣液瓶', customer: '蓝月亮', category: '包装', notes: 'PET材质，贴标方案', ugFile: 'detergent_bottle_2L.prt', filePath: 'D:\\设计资料库\\产品设计\\UG\\detergent_bottle_2L.prt', imageCount: 1, cadCount: 1, status: 'normal', lastScan: '2026-06-15' },
  { exId: 'EX-000004', excelPath: 'D:\\设计资料库\\产品设计\\零件清单.xlsx', sheetName: '包装容器', row: 15, originalId: 'PKG-2025-018', name: '5L机油桶', customer: '壳牌', category: '包装', notes: 'HDPE吹塑', ugFile: 'oil_bottle_5L.prt', filePath: 'D:\\设计资料库\\产品设计\\UG\\oil_bottle_5L.prt', imageCount: 0, cadCount: 1, status: 'missing_image', lastScan: '2026-06-15' },
  { exId: 'EX-000005', excelPath: 'D:\\设计资料库\\产品设计\\零件清单.xlsx', sheetName: '包装容器', row: 22, originalId: 'PKG-2025-022', name: '4L机油桶（方形）', customer: '嘉实多', category: '包装', notes: 'HDPE吹塑，方瓶设计', ugFile: 'oil_bottle_4L_square.prt', filePath: 'D:\\设计资料库\\产品设计\\UG\\oil_bottle_4L_square.prt', imageCount: 1, cadCount: 1, status: 'normal', lastScan: '2026-06-15' },
  { exId: 'EX-000006', excelPath: 'D:\\设计资料库\\产品设计\\产品清单.xlsx', sheetName: '其他', row: 5, originalId: 'HQ-2024-015', name: '多功能螺丝刀手柄', customer: '', category: '工具', notes: '可换批头设计', ugFile: 'screwdriver_handle.prt', filePath: 'D:\\设计资料库\\产品设计\\UG\\screwdriver_handle.prt', imageCount: 0, cadCount: 1, status: 'normal', lastScan: '2026-06-15' },
  { exId: 'EX-000007', excelPath: 'D:\\设计资料库\\产品设计\\电子产品清单.xlsx', sheetName: '音响类', row: 3, originalId: 'SPK-2025-001', name: '便携蓝牙音响', customer: 'Anker', category: '电子产品', notes: 'IPX7防水', ugFile: 'bt_speaker_v2.prt', filePath: 'D:\\设计资料库\\产品设计\\UG\\bt_speaker_v2.prt', imageCount: 1, cadCount: 1, status: 'normal', lastScan: '2026-06-14' },
],

cadFiles: [
  { cadId: 'CAD-000001', fileType: 'prt', filename: 'tiger_clamp_8inch.prt', path: 'D:\\设计资料库\\产品设计\\UG\\tiger_clamp_8inch.prt', folder: 'D:\\设计资料库\\产品设计\\UG', size: '45.2 MB', lastModified: '2025-11-18', hash: 'cadhash01', status: 'normal', imageCount: 2, exCount: 1, isMain: true, tags: ['老虎钳', '结构件'], notes: '' },
  { cadId: 'CAD-000002', fileType: 'step', filename: 'tiger_clamp_8inch.step', path: 'D:\\设计资料库\\产品设计\\STEP\\tiger_clamp_8inch.step', folder: 'D:\\设计资料库\\产品设计\\STEP', size: '12.8 MB', lastModified: '2025-11-18', hash: 'cadhash02', status: 'normal', imageCount: 0, exCount: 0, isMain: false, tags: ['老虎钳'], notes: '导出用' },
  { cadId: 'CAD-000003', fileType: 'prt', filename: 'pump_clamp_6inch.prt', path: 'D:\\设计资料库\\产品设计\\UG\\pump_clamp_6inch.prt', folder: 'D:\\设计资料库\\产品设计\\UG', size: '38.6 MB', lastModified: '2026-01-10', hash: 'cadhash03', status: 'normal', imageCount: 1, exCount: 1, isMain: true, tags: ['水泵钳'], notes: '' },
  { cadId: 'CAD-000004', fileType: 'prt', filename: 'detergent_bottle_2L.prt', path: 'D:\\设计资料库\\产品设计\\UG\\detergent_bottle_2L.prt', folder: 'D:\\设计资料库\\产品设计\\UG', size: '52.1 MB', lastModified: '2026-03-08', hash: 'cadhash04', status: 'normal', imageCount: 1, exCount: 1, isMain: true, tags: ['洗衣液瓶'], notes: '' },
  { cadId: 'CAD-000005', fileType: 'prt', filename: 'screwdriver_handle.prt', path: 'D:\\设计资料库\\产品设计\\UG\\screwdriver_handle.prt', folder: 'D:\\设计资料库\\产品设计\\UG', size: '18.3 MB', lastModified: '2025-08-05', hash: 'cadhash05', status: 'normal', imageCount: 1, exCount: 1, isMain: true, tags: ['工具手柄', '双色包胶'], notes: '' },
  { cadId: 'CAD-000006', fileType: 'step', filename: 'tool_handle_grip.step', path: 'D:\\设计资料库\\产品设计\\STEP\\tool_handle_grip.step', folder: 'D:\\设计资料库\\产品设计\\STEP', size: '5.2 MB', lastModified: '2025-08-05', hash: 'cadhash06', status: 'normal', imageCount: 0, exCount: 0, isMain: false, tags: ['工具手柄'], notes: '' },
  { cadId: 'CAD-000007', fileType: 'dwg', filename: 'handle_section.dwg', path: 'D:\\设计资料库\\产品设计\\DWG\\handle_section.dwg', folder: 'D:\\设计资料库\\产品设计\\DWG', size: '2.1 MB', lastModified: '2025-08-06', hash: 'cadhash07', status: 'normal', imageCount: 0, exCount: 0, isMain: false, tags: ['工具手柄', '草图'], notes: '截面图' },
  { cadId: 'CAD-000008', fileType: 'prt', filename: 'oil_bottle_5L.prt', path: 'D:\\设计资料库\\产品设计\\UG\\oil_bottle_5L.prt', folder: 'D:\\设计资料库\\产品设计\\UG', size: '48.9 MB', lastModified: '2026-02-25', hash: 'cadhash08', status: 'normal', imageCount: 1, exCount: 1, isMain: true, tags: ['机油桶'], notes: '' },
  { cadId: 'CAD-000009', fileType: 'prt', filename: 'oil_bottle_4L_square.prt', path: 'D:\\设计资料库\\产品设计\\UG\\oil_bottle_4L_square.prt', folder: 'D:\\设计资料库\\产品设计\\UG', size: '46.2 MB', lastModified: '2026-02-28', hash: 'cadhash09', status: 'normal', imageCount: 0, exCount: 1, isMain: true, tags: ['机油桶'], notes: '' },
  { cadId: 'CAD-000010', fileType: 'prt', filename: 'bt_speaker_v2.prt', path: 'D:\\设计资料库\\产品设计\\UG\\bt_speaker_v2.prt', folder: 'D:\\设计资料库\\产品设计\\UG', size: '62.4 MB', lastModified: '2026-04-01', hash: 'cadhash10', status: 'normal', imageCount: 1, exCount: 1, isMain: true, tags: ['音响', '外观方案'], notes: '' },
  { cadId: 'CAD-000011', fileType: 'sldprt', filename: 'clamp_jaw.sldprt', path: 'D:\\设计资料库\\产品设计\\SolidWorks\\clamp_jaw.sldprt', folder: 'D:\\设计资料库\\产品设计\\SolidWorks', size: '8.4 MB', lastModified: '2025-11-10', hash: 'cadhash11', status: 'suspected_dup', imageCount: 0, exCount: 0, isMain: false, tags: ['老虎钳'], notes: '疑似与 CAD-000001 重复' },
  { cadId: 'CAD-000012', fileType: 'prt', filename: 'cap_sample_01.prt', path: 'D:\\设计资料库\\产品设计\\UG\\cap_sample_01.prt', folder: 'D:\\设计资料库\\产品设计\\UG', size: '15.7 MB', lastModified: '2026-05-10', hash: 'cadhash12', status: 'normal', imageCount: 1, exCount: 0, isMain: true, tags: ['盖子', '结构件'], notes: '' },
],

pdfFiles: [
  { docId: 'DOC-000001', filename: '博世-冲击钻说明书.pdf', path: 'D:\\设计资料库\\客户参考\\博世-冲击钻说明书.pdf', folder: 'D:\\设计资料库\\客户参考', size: '3.8 MB', lastModified: '2025-06-01', hash: 'pdfhash01', pages: 24, previewPath: '博世-冲击钻说明书_preview.jpg', imgRef: 'IMG-000006', status: 'normal' },
  { docId: 'DOC-000002', filename: '产品规格书_老虎钳.pdf', path: 'D:\\设计资料库\\产品设计\\文档\\产品规格书_老虎钳.pdf', folder: 'D:\\设计资料库\\产品设计\\文档', size: '1.2 MB', lastModified: '2025-11-22', hash: 'pdfhash02', pages: 8, previewPath: '产品规格书_老虎钳_preview.jpg', imgRef: null, status: 'normal' },
  { docId: 'DOC-000003', filename: '表面处理工艺手册.pdf', path: 'D:\\设计资料库\\参考\\表面处理工艺手册.pdf', folder: 'D:\\设计资料库\\参考', size: '15.6 MB', lastModified: '2024-08-15', hash: 'pdfhash03', pages: 120, previewPath: '表面处理工艺手册_preview.jpg', imgRef: null, status: 'normal' },
],

matches: [
  { id: 1, imgId: 'IMG-000001', exId: 'EX-000001', cadId: 'CAD-000001', status: 'confirmed', method: 'excel-reference', confidence: 'high' },
  { id: 2, imgId: 'IMG-000003', exId: null, cadId: 'CAD-000003', status: 'auto', method: 'filename-match', confidence: 'high' },
  { id: 3, imgId: 'IMG-000004', exId: 'EX-000005', cadId: 'CAD-000008', status: 'confirmed', method: 'excel-reference', confidence: 'high' },
  { id: 4, imgId: 'IMG-000005', exId: null, cadId: 'CAD-000005', status: 'suspected', method: 'same-folder', confidence: 'medium' },
  { id: 5, imgId: 'IMG-000007', exId: 'EX-000003', cadId: 'CAD-000004', status: 'auto', method: 'excel-reference', confidence: 'high' },
  { id: 6, imgId: 'IMG-000008', exId: 'EX-000007', cadId: 'CAD-000010', status: 'auto', method: 'filename-similar', confidence: 'medium' },
  { id: 7, imgId: 'IMG-000009', exId: null, cadId: null, status: 'unmatched', method: null, confidence: null },
  { id: 8, imgId: 'IMG-000011', exId: null, cadId: 'CAD-000012', status: 'manual', method: 'manual-bind', confidence: 'high' },
],

scanHistory: [
  { id: 1, time: '2026-06-15 14:32', library: 'D:\\设计资料库\\产品设计', type: 'full', added: 23, removed: 2, modified: 5, moved: 1, errors: 0, duration: '4m 12s' },
  { id: 2, time: '2026-06-14 09:15', library: 'D:\\设计资料库\\客户参考', type: 'full', added: 8, removed: 0, modified: 1, moved: 0, errors: 0, duration: '1m 48s' },
  { id: 3, time: '2026-06-10 16:48', library: 'E:\\项目档案\\2025', type: 'incremental', added: 15, removed: 3, modified: 7, moved: 2, errors: 1, duration: '3m 05s' },
  { id: 4, time: '2026-06-01 08:00', library: 'D:\\设计资料库\\产品设计', type: 'full', added: 120, removed: 0, modified: 0, moved: 0, errors: 0, duration: '8m 30s' },
],

changeLogs: [
  { id: 1, time: '2026-06-15 14:32', type: 'image-added', imgId: 'IMG-000012', exId: null, cadId: null, docId: null, oldValue: '', newValue: '新增独立图片', path: 'D:\\设计资料库\\产品设计\\渲染图\\工具套装_v4.jpg', status: 'processed' },
  { id: 2, time: '2026-06-15 14:32', type: 'image-modified', imgId: 'IMG-000003', exId: null, cadId: null, docId: null, oldValue: 'hash:i9j0k1l2', newValue: 'hash:m3n4o5p6', path: 'D:\\设计资料库\\产品设计\\渲染图\\水泵钳_v3.jpg', status: 'processed' },
  { id: 3, time: '2026-06-15 14:32', type: 'cad-renamed', imgId: null, exId: null, cadId: 'CAD-000012', docId: null, oldValue: 'cap_v1.prt', newValue: 'cap_sample_01.prt', path: 'D:\\设计资料库\\产品设计\\UG\\cap_sample_01.prt', status: 'processed' },
  { id: 4, time: '2026-06-14 09:15', type: 'excel-modified', imgId: null, exId: 'EX-000003', cadId: null, docId: null, oldValue: 'hash:abc123', newValue: 'hash:def456', path: 'D:\\设计资料库\\产品设计\\零件清单.xlsx', status: 'processed' },
  { id: 5, time: '2026-06-14 09:15', type: 'image-deleted', imgId: 'IMG-000099', exId: null, cadId: null, docId: null, oldValue: '已删除', newValue: '', path: 'D:\\设计资料库\\客户参考\\旧图\\已废弃.jpg', status: 'processed' },
],

tags: [
  { name: '老虎钳', count: 5, category: '产品类型' },
  { name: '水泵钳', count: 3, category: '产品类型' },
  { name: '机油桶', count: 4, category: '产品类型' },
  { name: '洗衣液瓶', count: 2, category: '产品类型' },
  { name: '音响', count: 3, category: '产品类型' },
  { name: '工具手柄', count: 4, category: '部件' },
  { name: '盖子', count: 2, category: '部件' },
  { name: '结构件', count: 6, category: '设计类型' },
  { name: '外观方案', count: 5, category: '设计类型' },
  { name: '渲染图', count: 8, category: '图片来源' },
  { name: '实物照片', count: 4, category: '图片来源' },
  { name: '草图', count: 3, category: '图片来源' },
  { name: '参考图', count: 7, category: '图片来源' },
  { name: '双色包胶', count: 3, category: '工艺' },
  { name: '最终版', count: 5, category: '状态' },
  { name: '客户确认', count: 4, category: '状态' },
],

searchHistory: [
  { id: 1, time: '2026-06-16 15:30', imagePath: '客户发来老虎钳参考.jpg', resultCount: 12, topSimilarity: '94.2%' },
  { id: 2, time: '2026-06-16 10:15', imagePath: '截图_20260616.png', resultCount: 8, topSimilarity: '88.7%' },
  { id: 3, time: '2026-06-15 16:45', imagePath: '水泵钳客户样.jpg', resultCount: 5, topSimilarity: '91.3%' },
],

favorites: [
  { imgId: 'IMG-000001', addedAt: '2026-06-10', note: '常用参考' },
  { imgId: 'IMG-000003', addedAt: '2026-06-12', note: '' },
  { imgId: 'IMG-000005', addedAt: '2026-06-15', note: '手柄设计参考' },
],

}; // end MOCK

/* === Search Simulation === */
function simulateSearch(queryImage, scope) {
  const results = MOCK.imageAssets
    .filter(img => img.indexed)
    .filter(img => {
      if (scope === 'excel') return img.sourceType === 'excel-embedded';
      if (scope === 'standalone') return img.sourceType === 'standalone';
      if (scope === 'cad-linked') return img.cadRef !== null;
      if (scope === 'pdf') return img.sourceType === 'pdf-preview';
      if (scope === 'favorites') return MOCK.favorites.some(f => f.imgId === img.imgId);
      return true;
    })
    .map(img => ({
      ...img,
      similarity: (Math.random() * 30 + 65).toFixed(1),
    }))
    .sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity));

  return results;
}

/* === SVG Icon Library === */
const ICONS = {
  brand: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.75"/><rect x="7" y="7" width="10" height="10" stroke="currentColor" stroke-width="1.75"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>`,

  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="7"/><line x1="16" y1="16" x2="21.5" y2="21.5"/></svg>`,

  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M3 16.5l5.5-5.5 4 4 2.5-2.5L21 18.5"/></svg>`,

  cad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v10l9 5 9-5V7z"/><path d="M12 22V12"/><path d="M3 7l9 5 9-5"/></svg>`,

  excel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,

  pdf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`,

  library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,

  report: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,

  match: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,

  changelog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,

  tags: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1" fill="currentColor" stroke="none"/></svg>`,

  favorites: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,

  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

/* === Sidebar Navigation === */
function initSidebar() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const links = document.querySelectorAll('.sidebar-link');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === 'index.html' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Render SVG icons in sidebar
  renderSidebarIcons();

  // Add theme toggle to sidebar footer
  const footer = document.querySelector('.sidebar-footer');
  if (footer && !footer.querySelector('.theme-switch-btn')) {
    const btn = document.createElement('span');
    btn.className = 'theme-switch-btn';
    btn.style.cssText = 'margin-left:auto;cursor:pointer;opacity:0.6;';
    btn.title = '切换深色/浅色主题';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16" style="vertical-align:middle"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    btn.onclick = toggleTheme;
    footer.appendChild(btn);
  }
}

/* === Replace emoji/icons with SVGs === */
function renderSidebarIcons() {
  // Brand icon
  const brandIcon = document.querySelector('.sidebar-brand-icon');
  if (brandIcon) {
    brandIcon.innerHTML = ICONS.brand;
  }

  // Sidebar link icons — map by data-icon or fallback to emoji text matching
  const emojiMap = {
    '🔍': 'search',
    '🖼': 'image',
    '◇': 'cad',
    '📊': 'excel',
    '📄': 'pdf',
    '📁': 'library',
    '📋': 'report',
    '🔗': 'match',
    '📝': 'changelog',
    '🏷': 'tags',
    '★': 'favorites',
    '⚙': 'settings',
  };

  document.querySelectorAll('.sidebar-link-icon').forEach(el => {
    const text = el.textContent.trim();
    const iconName = el.dataset.icon || emojiMap[text];
    if (iconName && ICONS[iconName]) {
      el.innerHTML = ICONS[iconName];
    }
  });

  // Also replace launcher card icons
  document.querySelectorAll('.launcher-card-icon').forEach(el => {
    const text = el.textContent.trim();
    const iconName = el.dataset.icon || emojiMap[text];
    if (iconName && ICONS[iconName]) {
      el.innerHTML = ICONS[iconName];
      el.style.width = '28px';
      el.style.height = '28px';
    }
  });
}

/* === Utility: format bytes === */
function formatBytes(bytes) {
  if (typeof bytes === 'string') return bytes;
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* === Utility: toast notification === */
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

/* === Utility: source type label === */
function sourceTypeLabel(type) {
  const map = {
    'excel-embedded': 'Excel 内嵌',
    'standalone': '独立图片',
    'pdf-preview': 'PDF 预览',
    'manual': '手动补图',
    'search-history': '搜索历史',
  };
  return map[type] || type;
}

/* === Utility: status badge HTML === */
function statusBadge(status) {
  const map = {
    normal: 'badge-success',
    pending: 'badge-warning',
    missing: 'badge-danger',
    modified: 'badge-info',
    deleted: 'badge-danger',
    suspected_dup: 'badge-warning',
    confirmed: 'badge-success',
    auto: 'badge-info',
    suspected: 'badge-warning',
    unmatched: 'badge-muted',
    manual: 'badge-success',
    ignored: 'badge-muted',
  };
  return `<span class="badge ${map[status] || 'badge-muted'}">${status}</span>`;
}

/* === Utility: file type icon === */
function fileTypeIcon(type) {
  const map = {
    prt: '◇', step: '◆', stp: '◆', igs: '◇', iges: '◇',
    jt: '◈', sldprt: '◇', sldasm: '◈', dwg: '▤', dxf: '▤',
    x_t: '◇', x_b: '◇',
  };
  return map[type] || '◆';
}

/* === Theme Management === */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeToggleUI(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeToggleUI(next);
}

function updateThemeToggleUI(theme) {
  document.querySelectorAll('.theme-toggle').forEach(el => {
    if (theme === 'dark') {
      el.classList.add('on');
    } else {
      el.classList.remove('on');
    }
  });
}

/* === Init on load === */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
});
