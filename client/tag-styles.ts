export const tagStyles = `
.tag-picker {
  position: relative;
  width: 100%;
}
.tag-picker summary {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  list-style: none;
}
.tag-picker summary::-webkit-details-marker { display: none; }
.tag-picker summary:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.tag-picker summary svg { width: 15px; height: 15px; transition: transform .16s ease; }
.tag-picker[open] summary svg { transform: rotate(90deg); }
.tag-picker-menu {
  position: absolute;
  z-index: 12;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  max-height: 220px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 9px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.tag-picker-options label {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  margin: 0;
  padding: 6px 8px;
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
}
.tag-picker-options label:hover { background: var(--surface-subtle); }
.tag-picker-options input { width: auto; height: auto; margin: 0; accent-color: var(--blue); }
.tag-picker-create { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; padding: 2px 2px 7px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.tag-picker-create input {
  width: 100%;
  min-width: 0;
  height: 34px;
  padding: 0 9px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  outline: none;
  background: var(--bg);
}
.tag-picker-create input:focus { border-color: var(--blue); }
.tag-picker-create .button { min-height: 34px; padding: 5px 10px; }
.tag-picker-empty { margin: 0; color: var(--muted); font-size: 12px; }
.tag-add-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-bottom: 12px; }
.tag-add-row .detail-input { height: 38px; }

@media (max-width: 520px) {
  .tag-picker-menu { position: static; margin-top: 5px; box-shadow: none; }
}
`;
