import React from "react";

// Catches render errors anywhere in the subtree so a malformed import
// or a graph edge case doesn't whiteout the page. Provides a "Reset
// app data" escape hatch so the user can recover without dev tools.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    if (typeof console !== "undefined") {
      console.error("[ErrorBoundary]", error, info);
    }
  }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = (this.state.error && (this.state.error.message || String(this.state.error))) || "unknown error";
    return (
      <div className="error-boundary">
        <div className="eb-card">
          <div className="eb-title">something broke</div>
          <pre className="eb-msg">{msg}</pre>
          <div className="eb-meta mono">
            this is usually because the saved data isn't valid. you can reload, or
            wipe local data to start fresh — your import file (if any) is untouched.
          </div>
          <div className="eb-actions">
            <button onClick={() => location.reload()}>reload page</button>
            <button onClick={() => {
              try {
                ["trunkline.ledger", "trunkline.tweaks", "trunkline.unbacked",
                 "finance-tracker.ledger", "finance-tracker.tweaks",
                 "finance-tracker.unbacked", "finance-tracker.userTags"]
                 .forEach(k => localStorage.removeItem(k));
              } catch (e) { /* ignore */ }
              location.reload();
            }} className="eb-danger">wipe local data &amp; reload</button>
          </div>
        </div>
      </div>
    );
  }
}
