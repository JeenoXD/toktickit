import { useEffect, useMemo, useState } from "react";
import { createUser, fetchUsers, resetUserPassword, updateUser, UserRecord } from "./api.js";

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "REQUESTER",
    isActive: true,
    initialPassword: "",
  });
  const [resetPassword, setResetPassword] = useState("");

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchSearch = !search || `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase());
      const matchRole = !roleFilter || user.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers({ search: search || undefined, role: roleFilter || undefined });
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createUser({
        name: form.name,
        email: form.email,
        role: form.role,
        isActive: form.isActive,
        initialPassword: form.initialPassword,
      });
      setShowCreate(false);
      setForm({ name: "", email: "", role: "REQUESTER", isActive: true, initialPassword: "" });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user");
    }
  }

  async function handleUpdateUser(userId: number, payload: Partial<UserRecord>) {
    try {
      await updateUser(userId, payload);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user");
    }
  }

  async function handleResetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (selectedUserId === null) return;
    try {
      await resetUserPassword(selectedUserId, resetPassword);
      setShowReset(false);
      setResetPassword("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    }
  }

  return (
    <div className="container py-4">
      <h2>User Management</h2>

      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <input
          aria-label="Search"
          className="form-control"
          style={{ maxWidth: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email"
        />

        <label className="d-flex align-items-center gap-2 mb-0">
          <span>Role Filter</span>
          <select aria-label="Role Filter" className="form-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All</option>
            <option value="REQUESTER">Requester</option>
            <option value="IT_STAFF">IT Staff</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
        </label>

        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create User</button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? <p>Loading users…</p> : filteredUsers.length === 0 ? <div className="alert alert-info">No users match your filters.</div> : (
        <div className="table-responsive">
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.isActive ? "Active" : "Inactive"}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => handleUpdateUser(user.id, { isActive: !user.isActive })}>
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                        setSelectedUserId(user.id);
                        setShowReset(true);
                      }}>
                        Reset Password
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content p-3">
              <h3 className="mb-3">Create User</h3>
              <form onSubmit={handleCreateUser}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="user-name">Name</label>
                  <input id="user-name" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="user-email">Email</label>
                  <input id="user-email" type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="user-role">Role</label>
                  <select id="user-role" className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    <option value="REQUESTER">Requester</option>
                    <option value="IT_STAFF">IT Staff</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="user-active">Status</label>
                  <select id="user-active" className="form-select" value={String(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="user-password">Initial Password</label>
                  <input id="user-password" type="password" className="form-control" value={form.initialPassword} onChange={(e) => setForm({ ...form, initialPassword: e.target.value })} required />
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save User</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showReset && selectedUserId !== null && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,0.35)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content p-3">
              <h3 className="mb-3">Reset Password</h3>
              <form onSubmit={handleResetPassword}>
                <div className="mb-3">
                  <label className="form-label" htmlFor="reset-password">New Password</label>
                  <input id="reset-password" type="password" className="form-control" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required />
                </div>
                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowReset(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Password</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
