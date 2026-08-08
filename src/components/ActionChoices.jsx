import React from 'react'

export default function ActionChoices({ choices = [], pending = false, disabled = false, onChoose, onRefresh }) {
  if (!pending && !choices.length) return null
  return (
    <section className="action-choices" aria-label="Lựa chọn hành động gợi ý">
      <div className="action-choices__head">
        <div>
          <div className="action-choices__eyebrow">BƯỚC TIẾP THEO</div>
          <div className="action-choices__title">✦ Lựa chọn hành động</div>
        </div>
        <div className="action-choices__controls">
          <span className="action-choices__hint">Bấm để điền · vẫn sửa được trước khi gửi</span>
          {onRefresh && (
            <button
              type="button"
              className="action-choices__refresh"
              disabled={disabled || pending}
              onClick={onRefresh}
              title="Bỏ các gợi ý hiện tại và sinh lại từ đúng chính văn của lượt này"
            >
              {pending ? '↻ Đang tạo…' : '↻ Gợi ý lại'}
            </button>
          )}
        </div>
      </div>
      {pending && !choices.length ? (
        <div className="action-choices__loading"><span /> Đang đọc tình huống để chuẩn bị gợi ý…</div>
      ) : (
        <div className="action-choices__grid">
          {choices.map((choice, index) => (
            <button
              key={`${choice.id ?? index}-${choice.text}`}
              type="button"
              className="action-choice"
              disabled={disabled}
              onClick={() => onChoose?.(choice)}
              title="Đưa hành động này vào ô nhập"
            >
              <span className="action-choice__badge">{choice.id ?? String.fromCharCode(65 + index)}</span>
              <span className="action-choice__body">
                <span className="action-choice__label">{choice.label || `Lựa chọn ${index + 1}`}</span>
                <span className="action-choice__text">{choice.text}</span>
              </span>
              <span className="action-choice__arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
