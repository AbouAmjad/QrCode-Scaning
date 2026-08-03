/**
 * label-api.js — Server template + catalog helpers.
 * Uses global apiGet / apiPostForm from config.js when available.
 */
async function callGet(params) {
  if (typeof apiGet === "function") return apiGet(params);
  const token =
    (typeof getApiToken === "function" && getApiToken()) ||
    localStorage.getItem("token") ||
    "";
  const url =
    (typeof AppConfig !== "undefined" && AppConfig.SCRIPT_URL) ||
    location.origin + "/api";
  const qs = new URLSearchParams({ ...params, token });
  const res = await fetch(`${url}?${qs}`);
  return res.json();
}

async function callPost(fields) {
  if (typeof apiPostForm === "function") return apiPostForm(fields);
  const token =
    (typeof getApiToken === "function" && getApiToken()) ||
    localStorage.getItem("token") ||
    "";
  const url =
    (typeof AppConfig !== "undefined" && AppConfig.SCRIPT_URL) ||
    location.origin + "/api";
  const body = new URLSearchParams({ ...fields, token });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  return res.json();
}

export async function listTemplates() {
  const data = await callGet({ action: "listLabelTemplates" });
  if (data?.error) throw new Error(data.error);
  return data.items || [];
}

export async function saveTemplate(name, config, id = null) {
  const payload = {
    action: "saveLabelTemplate",
    name,
    config: typeof config === "string" ? config : JSON.stringify(config)
  };
  if (id) payload.id = id;
  const data = await callPost(payload);
  if (data?.error) throw new Error(data.error);
  return data.item || data;
}

export async function deleteTemplate(id) {
  const data = await callPost({ action: "deleteLabelTemplate", id });
  if (data?.error) throw new Error(data.error);
  return true;
}

export async function listPeople() {
  const data = await callGet({ action: "listPeople" });
  if (data?.error) throw new Error(data.error);
  return data.items || [];
}

export async function listCatalog() {
  const data = await callGet({ action: "getCatalogStock" });
  if (data?.error) throw new Error(data.error);
  return data.items || [];
}

export default {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  listPeople,
  listCatalog
};
