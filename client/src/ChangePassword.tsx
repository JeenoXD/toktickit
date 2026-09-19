import { useState } from "react";
import { changePassword } from "./api.js";
import { useAuth } from "./AuthContext";

export default function ChangePassword() {
  const { refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      await refreshUser();
    } catch (err) {
      setError((err as Error).message || "Unable to change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4 mx-auto" style={{ maxWidth: 420 }}>
      <h2>Update Password</h2>
      <p className="text-muted">You must set a new password before continuing.</p>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="currentPassword" className="form-label">Current Password</label>
          <input
            id="currentPassword"
            type="password"
            className="form-control"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="newPassword" className="form-label">New Password</label>
          <input
            id="newPassword"
            type="password"
            className="form-control"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            disabled={busy}
          />
        </div>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        <button type="submit" className="btn btn-success w-100" disabled={busy}>
          {busy ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}