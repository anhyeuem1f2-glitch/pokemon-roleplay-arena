import React from 'react'

// ============ ERROR BOUNDARY (đợt 39) ============
// Trước đây bất kỳ lỗi runtime nào (VD trong BattleModal) khiến React gỡ
// TOÀN BỘ cây → màn hình đen thui, không biết lỗi gì (báo cáo: "ấn Test
// Battle mất hết màn hình"). Bọc app trong boundary này → lỗi hiện thông
// báo + nút thử lại thay vì đen màn, kèm chi tiết lỗi để dễ sửa.

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] lỗi runtime:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="panel" style={{ maxWidth: 560 }}>
            <h2 className="page-title" style={{ color: '#d94f4f' }}>Đã xảy ra lỗi</h2>
            <p style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>
              Một phần giao diện bị lỗi runtime. Truyện/cấu hình của bạn KHÔNG mất (vẫn lưu trong
              localStorage) — bấm "Thử lại" để dựng lại giao diện.
            </p>
            <pre style={{ fontSize: 11, color: '#d94f4f', background: 'var(--bg-deep)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn btn--primary" onClick={() => this.setState({ error: null })}>
                Thử lại
              </button>
              <button className="btn" onClick={() => window.location.reload()}>
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
