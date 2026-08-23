/**
 * Trọng số tiêu chí -> PHẦN TRĂM.
 *
 * Người dùng đọc "trọng số 2" không biết nó nặng bao nhiêu, vì nó chỉ có nghĩa khi đặt cạnh
 * tổng trọng số của cả bộ. Con số thật sự dễ hiểu là tỉ trọng: 2 / (2+1+1) = 50%.
 *
 * DB vẫn lưu `weight` — đây thuần là lớp hiển thị. Nhờ vậy tổng LUÔN đúng 100% mà không phải
 * bắt người dùng ngồi canh cho tròn số, và dữ liệu cũ không cần sửa gì.
 *
 * Làm tròn theo "số dư lớn nhất" (Hamilton) chứ không Math.round từng dòng: làm tròn độc lập
 * cho ra những bộ cộng lại thành 99% hoặc 101%, mà cả điểm của việc đổi sang phần trăm là để
 * người đọc cộng nhẩm ra đúng 100.
 */
export function weightPercents(weights) {
  const nums = (weights || []).map((w) => {
    const n = Number(w);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const total = nums.reduce((a, b) => a + b, 0);

  // Chưa có tiêu chí nào, hoặc tất cả trọng số bằng 0 -> không có tỉ trọng để chia.
  if (total <= 0) return nums.map(() => 0);

  const exact = nums.map((n) => (n / total) * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);

  // Phát nốt phần lẻ cho những dòng có phần thập phân lớn nhất.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const out = floors.slice();
  for (let k = 0; k < order.length && remainder > 0; k += 1, remainder -= 1) {
    out[order[k].i] += 1;
  }
  return out;
}

/**
 * Tiện cho các bảng: trả map id -> phần trăm.
 * `idKey` mặc định là `criteriaId` — tên khoá BE trả về ở phiếu chấm và danh sách tiêu chí.
 */
export function weightPercentMap(items, idKey = 'criteriaId') {
  const list = items || [];
  const percents = weightPercents(list.map((c) => c?.weight));
  const map = {};
  list.forEach((c, i) => {
    const id = c?.[idKey];
    if (id != null) map[id] = percents[i];
  });
  return map;
}
