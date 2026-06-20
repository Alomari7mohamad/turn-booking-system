// يلفّ دوال الـ controllers غير المتزامنة لتمرير أي خطأ تلقائيًا إلى error middleware
// بدل تكرار try/catch في كل دالة.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
