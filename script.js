"use strict";

import {
  AS_OF_DATE,
  calculateTax,
  effectiveBillStatus,
  markBillingRecordPaid,
  outstandingBillingRecords,
} from "./billing.mjs";
import { createPortalStateStore } from "./portal-state.mjs";

const REPORT_STATUSES = [
  "Submitted",
  "Acknowledged",
  "In Progress",
  "Resolved",
];
const REPORT_CATEGORIES = [
  "Roads",
  "Streetlights",
  "Sanitation",
  "Drainage",
  "Safety",
];
const seedData = {
  households: [
    {
      id: "h1",
      accountNumber: "0231-4470",
      password: "resident123",
      headName: "Juan Dela Cruz",
      address: "123 Main Street, Purok 1",
    },
    {
      id: "h2",
      accountNumber: "0231-4471",
      password: "resident123",
      headName: "Maria Santos",
      address: "456 Oak Avenue, Purok 2",
    },
    {
      id: "h3",
      accountNumber: "0231-4472",
      password: "resident123",
      headName: "Elena Reyes",
      address: "78 Hill Road, Purok 3",
    },
  ],
  staff: [
    {
      id: "s1",
      username: "staff",
      password: "staff123",
      name: "Ana Villanueva",
      office: "Barangay Office",
      role: "staff",
    },
  ],
  waterBills: [
    {
      id: "w1",
      householdId: "h1",
      period: "September 2026",
      consumption: 15,
      amountDue: 450,
      status: "Overdue",
      dueDate: "2026-09-05",
    },
    {
      id: "w2",
      householdId: "h1",
      period: "August 2026",
      consumption: 12,
      amountDue: 360,
      status: "Paid",
      dueDate: "2026-09-05",
    },
    {
      id: "w3",
      householdId: "h2",
      period: "September 2026",
      consumption: 20,
      amountDue: 600,
      status: "Overdue",
      dueDate: "2026-09-05",
    },
    {
      id: "w4",
      householdId: "h3",
      period: "September 2026",
      consumption: 10,
      amountDue: 300,
      status: "Paid",
      dueDate: "2026-10-05",
    },
  ],
  propertyTaxes: [
    {
      id: "t1",
      householdId: "h1",
      year: 2026,
      assessedValue: 500000,
      amountDue: 9000,
      discountApplied: 0,
      penaltyAccrued: 0,
      status: "Unpaid",
      dueDate: "2026-12-31",
    },
    {
      id: "t2",
      householdId: "h2",
      year: 2026,
      assessedValue: 800000,
      amountDue: 14400,
      discountApplied: 0,
      penaltyAccrued: 0,
      status: "Unpaid",
      dueDate: "2026-12-31",
    },
    {
      id: "t3",
      householdId: "h3",
      year: 2026,
      assessedValue: 600000,
      amountDue: 10800,
      discountApplied: 1200,
      penaltyAccrued: 0,
      status: "Paid",
      dueDate: "2026-12-31",
    },
  ],
  reports: [
    {
      id: "r1",
      householdId: "h1",
      title: "Pothole near the intersection",
      description:
        "The pothole is getting wider and makes the crossing difficult to pass safely.",
      location: "Main Street and First Avenue",
      category: "Roads",
      status: "Submitted",
      createdAt: "2026-09-20",
      updatedAt: "2026-09-20",
    },
    {
      id: "r2",
      householdId: "h1",
      title: "Streetlight outside the school",
      description: "The light has been out for about a week.",
      location: "Main Street, in front of the school",
      category: "Streetlights",
      status: "In Progress",
      createdAt: "2026-09-15",
      updatedAt: "2026-09-18",
    },
    {
      id: "r3",
      householdId: "h2",
      title: "Missed garbage collection",
      description: "Our scheduled collection was missed for three days.",
      location: "Oak Avenue, Purok 2",
      category: "Sanitation",
      status: "Resolved",
      createdAt: "2026-09-10",
      updatedAt: "2026-09-12",
    },
    {
      id: "r4",
      householdId: "h3",
      title: "Blocked drainage",
      description: "Leaves and mud are blocking the drain after heavy rain.",
      location: "Hill Road, Purok 3",
      category: "Drainage",
      status: "Acknowledged",
      createdAt: "2026-09-18",
      updatedAt: "2026-09-19",
    },
  ],
  questions: [
    {
      id: "q1",
      householdId: "h2",
      question: "When is the next barangay assembly?",
      answer:
        "The regular assembly is scheduled for October 15, 2026 at 2:00 PM in the covered court.",
      answeredBy: "Ana Villanueva",
      answeredAt: "2026-09-19",
      upvotes: 8,
      createdAt: "2026-09-18",
      comments: [
        {
          id: "c1",
          householdId: "h1",
          text: "Thanks for the info!",
          createdAt: "2026-09-19",
        },
        {
          id: "c2",
          householdId: "h3",
          text: "Will there be snacks?",
          createdAt: "2026-09-19",
        },
      ],
    },
    {
      id: "q2",
      householdId: "h1",
      question: "How do I request a barangay clearance?",
      answer: "",
      answeredBy: "",
      upvotes: 3,
      createdAt: "2026-09-20",
      comments: [],
    },
  ],
};

const stateStore = createPortalStateStore(
  {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  },
  seedData,
);
let state;
let session = { user: null, view: "home" };
let toastTimer;

function dateAtNoon(value) {
  if (value instanceof Date) return new Date(value);
  const text = String(value);
  return new Date(/T/.test(text) ? text : `${text}T12:00:00`);
}
function money(value) {
  return `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function dateLabel(value) {
  return dateAtNoon(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ],
  );
}
function initials(name) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function householdFor(id) {
  return state.households.find((household) => household.id === id);
}
function isResident() {
  return session.user?.role === "resident";
}
function isStaff() {
  return session.user?.role === "staff";
}
function currentHousehold() {
  return householdFor(session.user?.id);
}

function getUserUpvotes() {
  try {
    const stored = localStorage.getItem(`upvotes_${session.user?.id}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setUserUpvotes(upvotes) {
  try {
    localStorage.setItem(`upvotes_${session.user?.id}`, JSON.stringify(upvotes));
  } catch {
    // Ignore storage errors
  }
}

function hasUserUpvoted(questionId) {
  return getUserUpvotes().includes(questionId);
}

function toggleUserUpvote(questionId) {
  const upvotes = getUserUpvotes();
  const index = upvotes.indexOf(questionId);
  if (index >= 0) {
    upvotes.splice(index, 1);
  } else {
    upvotes.push(questionId);
  }
  setUserUpvotes(upvotes);
}
function statusTone(status) {
  return (
    {
      Paid: "paid",
      Resolved: "resolved",
      Unpaid: "unpaid",
      Submitted: "submitted",
      Pending: "pending",
      Overdue: "overdue",
      Acknowledged: "acknowledged",
      "In Progress": "in-progress",
    }[status] || "pending"
  );
}
function badge(status) {
  return `<span class="status status-${statusTone(status)}">${escapeHtml(status)}</span>`;
}

function topbar(user) {
  return `<header class="topbar"><div class="page topbar-inner">
    <a class="brand" href="#main-content" aria-label="Barangay Connect home"><span class="brand-mark" aria-hidden="true">b</span><span><span class="brand-name">Barangay Alubijid Connect</span><span class="brand-caption">Your barangay, closer</span></span></a>
    <div class="topbar-meta">${user ? `<span class="topbar-user"><span class="avatar" aria-hidden="true">${initials(user.role === "staff" ? user.name : user.headName)}</span><span>${escapeHtml(user.role === "staff" ? user.name : user.headName)}</span></span><button class="link-button" type="button" data-action="logout">Sign out</button>` : "<span>Official resident services</span>"}</div>
  </div></header>`;
}

function renderLogin() {
  document.title = "Sign in · Barangay Connect";
  document.getElementById("app").innerHTML = `<div class="login-page">
    <section class="login-intro"><div><p class="eyebrow">Barangay services · resident portal</p><h1 class="display-title">Your concerns,<br>closer to home.</h1><p class="login-intro-copy">Check your bills, follow community reports, and get clear answers from the people who serve your barangay.</p><div class="intro-rule"></div><p class="intro-note">Portal access is created at the barangay hall after residency verification. Payments are made through official channels outside this portal.</p></div><span class="intro-mark" aria-hidden="true">✳</span></section>
    <section class="login-panel"><div class="login-card"><p class="eyebrow">Welcome back</p><h2>Sign in to your account</h2><p>Use your household account number and password.</p><form id="login-form" class="form-stack" novalidate>
      <div class="field"><label for="account-input">Account number</label><input id="account-input" name="account" autocomplete="username" placeholder="0000-0000" required></div>
      <div class="field"><label for="password-input">Password</label><input id="password-input" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required></div>
      <p id="login-error" class="form-error" role="alert" hidden></p><button class="button" type="submit">Sign in</button>
    </form><div class="demo-box"><p>Portfolio demo accounts</p><div class="demo-row"><span>Resident</span><code>0231-4470 / resident123</code></div><div class="demo-row"><span>Staff</span><code>staff / staff123</code></div></div></div></section>
  </div>`;
  document.getElementById("login-form").addEventListener("submit", handleLogin);
}

function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const account = String(form.get("account") || "").trim();
  const password = String(form.get("password") || "");
  const household = state.households.find(
    (item) =>
      item.accountNumber.toLowerCase() === account.toLowerCase() &&
      item.password === password,
  );
  const staff = state.staff.find(
    (item) =>
      item.username.toLowerCase() === account.toLowerCase() &&
      item.password === password,
  );
  const user = household
    ? { ...household, role: "resident" }
    : staff
      ? { ...staff, role: "staff" }
      : null;
  if (!user) {
    const error = document.getElementById("login-error");
    error.textContent =
      "That account number or password is not recognized. Please try again.";
    error.hidden = false;
    return;
  }
  if (!commitState(state)) return;
  session = { user, view: "home" };
  renderPortal();
}

function logout() {
  session = { user: null, view: "home" };
  renderLogin();
}

function residentNavigation() {
  return [
    ["home", "Overview"],
    ["bills", "My bills"],
    ["reports", "My reports"],
    ["questions", "Community Q&A"],
  ];
}
function staffNavigation() {
  return [
    ["home", "Overview"],
    ["queue", "Report queue"],
    ["billing", "Billing records"],
    ["questions", "Answer questions"],
  ];
}

function portalHeader(eyebrow, title, copy, actions = "") {
  return `<div class="portal-header"><div class="portal-header-row"><div class="portal-header-copy"><p class="eyebrow">${eyebrow}</p><h1 class="display-title">${title}</h1><p>${copy}</p></div>${actions}</div></div>`;
}

function renderPortal() {
  if (!session.user) {
    renderLogin();
    return;
  }
  if (isResident()) renderResident();
  else renderStaff();
}

function renderResident() {
  const household = currentHousehold();
  const navigation = residentNavigation();
  document.title = `${session.user.headName} · Barangay Connect`;
  document.getElementById("app").innerHTML =
    `${topbar(session.user)}${portalNavigation(navigation, session.view)}<main id="main-content" class="page portal-page">${portalHeader("Resident portal", `Good morning, ${escapeHtml(household.headName.split(" ")[0])}.`, "A clear view of what needs your attention today.", `<div class="account-chip"><span class="avatar" aria-hidden="true">${initials(household.headName)}</span><div><span>Household account</span><strong>${escapeHtml(household.accountNumber)}</strong></div></div>`)}<div class="portal-grid"><div class="stack">${residentView(session.view)}</div><aside class="stack">${residentAside()}</aside></div></main>`;
}

function residentView(view) {
  const bills = state.waterBills.filter(
    (bill) => bill.householdId === session.user.id,
  );
  const reports = state.reports.filter(
    (report) => report.householdId === session.user.id,
  );
  const questions = state.questions;
  if (view === "bills")
    return `
  <section class="card" id="bills">
    <div class="card-header">
      <div>
        <h2>My bills</h2><p>Water and property tax records for this household.</p>
      </div>
    </div>
    <div class="card-body">${waterBillSummary(bills)}${taxSummary(state.propertyTaxes.filter((tax) => tax.householdId === session.user.id))}</div>
    </section>`;
  if (view === "reports")
    return `<section class="card" id="reports"><div class="card-header"><div><h2>My reports</h2><p>Track the progress of concerns you submitted.</p></div><button class="button compact" type="button" data-action="toggle-report-form">+ Report an issue</button></div><div class="card-body"><div class="inline-form" id="report-form" hidden><h3>Tell us what is happening</h3><form id="issue-form" class="form-stack" novalidate><div class="field"><label for="report-title">Title</label><input id="report-title" name="title" maxlength="90" placeholder="For example, pothole near the school" required></div><div class="field"><label for="report-description">Description</label><textarea id="report-description" name="description" maxlength="1000" placeholder="What should our team know?" required></textarea></div><div class="field"><label for="report-location">Location</label><input id="report-location" name="location" maxlength="140" placeholder="Street, landmark, or nearby house number" required></div><div class="field"><label for="report-category">Category</label><select id="report-category" name="category" required><option value="">Choose a category</option>${REPORT_CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}</select></div><div class="field"><label for="report-images">Photos (optional)</label><input id="report-images" name="images" type="file" accept="image/*" multiple><p class="field-hint">Add up to 5 photos to help our team understand the issue better.</p><div id="report-image-preview" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;"></div></div><p class="form-error" id="report-error" role="alert" hidden></p><div class="form-actions"><button class="button" type="submit">Send report</button><button class="button secondary" type="button" data-action="hide-report-form">Cancel</button></div></form></div><div class="report-list" id="report-list">${renderResidentReports(reports)}</div></div></section>`;
  if (view === "questions") {
    const totalQuestions = questions.length;
    const answeredQuestions = questions.filter(q => q.answer).length;
    const unansweredQuestions = totalQuestions - answeredQuestions;
    const myQuestions = questions.filter(q => q.householdId === session.user.id).length;
    
    return `<section class="card qa-section" id="questions">
      <div class="card-header qa-header">
        <div class="qa-header-content">
          <h2>Community Q&A</h2>
          <p>Ask the barangay a question. Staff answers appear here for everyone to see.</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div class="qa-stats">
            <span class="qa-stat"><strong>${totalQuestions}</strong> total</span>
            <span class="qa-stat"><strong>${answeredQuestions}</strong> answered</span>
            <span class="qa-stat"><strong>${unansweredQuestions}</strong> pending</span>
          </div>
          <button class="button compact" type="button" data-action="toggle-question-form">+ Ask a question</button>
        </div>
      </div>
      <div class="card-body">
        <div class="qa-form-wrapper">
          <div class="inline-form" id="question-form" hidden>
            <h3>Ask the barangay</h3>
            <form id="qa-form" class="form-stack" novalidate>
              <div class="field"><label for="question-input">Your question</label><textarea id="question-input" name="question" maxlength="500" placeholder="Keep it clear and specific so staff can help." required></textarea></div>
              <p class="form-error" id="question-error" role="alert" hidden></p>
              <div class="form-actions"><button class="button" type="submit">Post question</button><button class="button secondary" type="button" data-action="hide-question-form">Cancel</button></div>
            </form>
          </div>
        </div>
        <div class="qa-list" id="qa-list">${renderQuestions(questions)}</div>
      </div>
    </section>`;
  }
  return `<section class="card" id="home-summary"><div class="card-header"><div><h2>Your account</h2><p>${escapeHtml(householdFor(session.user.id).address)}</p></div></div><div class="card-body"><div class="quick-actions"><button class="quick-action" type="button" data-action="navigate" data-view="bills"><strong>View my bills</strong><span>↗</span></button><button class="quick-action" type="button" data-action="navigate" data-view="reports"><strong>Report an issue</strong><span>＋</span></button><button class="quick-action" type="button" data-action="navigate" data-view="questions"><strong>Ask a question</strong><span>?</span></button><button class="quick-action" type="button" data-action="navigate" data-view="bills"><strong>Payment guidance</strong><span>↗</span></button></div></div></section><section class="card" id="attention"><div class="card-header"><div><h2>Needs attention</h2><p>Only the items that may need a closer look.</p></div></div><div class="card-body">${renderAttention()}</div></section>${waterBillSummary(bills)}${taxSummary(state.propertyTaxes.filter((tax) => tax.householdId === session.user.id))}`;
}

function residentAside() {
  const household = currentHousehold();
  return `<section class="card"><div class="card-header"><div><h3>At a glance</h3><p>Your most recent resident activity.</p></div></div><div class="card-body"><div class="list"><div class="list-row"><div class="list-row-main"><strong>${state.reports.filter((report) => report.householdId === session.user.id).length} reports submitted</strong><p>Track updates from the barangay team.</p></div><span>↗</span></div><div class="list-row"><div class="list-row-main"><strong>${state.questions.filter((question) => question.householdId === session.user.id).length} questions asked</strong><p>Staff responses are public community answers.</p></div><span>↗</span></div></div></div></section><section class="card"><div class="card-header"><div><h3>Electricity</h3><p>Reference information only.</p></div></div><div class="card-body"><div class="reference-card"><div class="reference-icon" aria-hidden="true">M</div><div class="reference-copy"><h3>Provided by MORESCO</h3><p>MORESCO handles your electricity account and payments. Barangay Connect does not show or process an electricity bill.</p></div><a class="reference-link" href="https://moresco.ph/" target="_blank" rel="noreferrer">Visit MORESCO ↗</a></div></div></section><section class="card"><div class="card-header"><div><h3>Need help?</h3><p>We are here during office hours.</p></div></div><div class="card-body"><p class="muted" style="margin:0;font-size:13px">Monday–Friday<br>8:00 AM–5:00 PM<br><strong>Barangay Hall, Your Municipality</strong></p></div></section><div class="account-chip"><span>Household account</span><strong>${escapeHtml(household.accountNumber)}</strong></div>`;
}

function waterBillSummary(bills) {
  const sorted = [...bills].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  return `<section class="card" id="water-bills"><div class="card-header"><div><h2>Water billing</h2><p>Municipality-run utility · latest record first</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="bills">See all</button></div><div class="card-body"><div class="bills-list">${sorted.slice(0, 2).map(waterBillRow).join("") || '<p class="empty">No water bills available.</p>'}</div></div></section>`;
}
function waterBillRow(bill) {
  return `<article class="bill-item"><div class="bill-top"><span class="bill-period">${escapeHtml(bill.period)}</span>${badge(effectiveBillStatus(bill))}</div><div class="bill-meta"><span>Consumption <strong>${escapeHtml(bill.consumption)} cu.m.</strong></span><span>Due ${dateLabel(bill.dueDate)}</span></div><div class="bill-amount">${money(bill.amountDue)}</div><button class="detail-toggle" type="button" data-action="toggle-detail" data-detail-id="water-${escapeHtml(bill.id)}" aria-expanded="false" aria-controls="water-${escapeHtml(bill.id)}-detail">Payment details</button><div class="detail-panel" id="water-${escapeHtml(bill.id)}-detail" hidden>Pay at the barangay treasury or through an official payment channel. This portal only reflects the status recorded by staff.</div></article>`;
}
function taxSummary(taxes) {
  const tax = taxes[0];
  if (!tax)
    return '<section class="card"><div class="card-header"><div><h2>Property tax</h2></div></div><div class="card-body"><p class="empty">No property tax record available.</p></div></section>';
  const calculation = calculateTax(tax);
  return `<section class="card" id="property-tax"><div class="card-header"><div><h2>Property tax · ${tax.year}</h2><p>Annual assessment · due December 31</p></div>${badge(tax.status)}</div><div class="card-body"><div class="bill-top"><span class="bill-period">Assessed value ${money(tax.assessedValue)}</span><span class="muted" style="font-size:12px">2% annual rate</span></div><div class="tax-breakdown"><div class="tax-line"><span>Assessed value × 2%</span><strong>${money(calculation.base)}</strong></div>${calculation.discount ? `<div class="tax-line discount"><span>Early-payment discount (10%)</span><strong>− ${money(calculation.discount)}</strong></div>` : ""}${calculation.penalty ? `<div class="tax-line penalty"><span>Late-payment penalty</span><strong>+ ${money(calculation.penalty)}</strong></div>` : ""}<div class="tax-line total"><span>Amount currently due</span><strong>${money(calculation.total)}</strong></div></div><p class="muted" style="margin:15px 0 0;font-size:12px">A 10% discount is available through October 31. Payments after December 31 accrue a 2% monthly penalty.</p></div></section>`;
}
function renderAttention() {
  const overdueWater = state.waterBills.filter(
    (bill) =>
      bill.householdId === session.user.id &&
      effectiveBillStatus(bill) === "Overdue",
  );
  const submitted = state.reports.filter(
    (report) =>
      report.householdId === session.user.id && report.status === "Submitted",
  );
  const tax = state.propertyTaxes.find(
    (item) => item.householdId === session.user.id,
  );
  const taxNeedsAction =
    tax && tax.status !== "Paid" && calculateTax(tax).total > 0;
  if (!overdueWater.length && !submitted.length && !taxNeedsAction)
    return '<p class="empty">Nothing needs your attention right now.</p>';
  return `<div class="list"><div class="list-row"><div class="list-row-main"><strong>Outstanding water balance</strong><p>${overdueWater.length} overdue record${overdueWater.length === 1 ? "" : "s"} · ${money(overdueWater.reduce((sum, bill) => sum + bill.amountDue, 0))}</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="bills">View</button></div><div class="list-row"><div class="list-row-main"><strong>Community reports</strong><p>${submitted.length} report${submitted.length === 1 ? "" : "s"} waiting for staff acknowledgement.</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="reports">View</button></div><div class="list-row"><div class="list-row-main"><strong>Annual property tax</strong><p>${taxNeedsAction ? "Due December 31, 2026." : "No action needed."}</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="bills">View</button></div></div>`;
}
function renderResidentReports(reports) {
  if (!reports.length)
    return '<p class="empty">You have not submitted any reports yet.</p>';
  return [...reports]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(
      (report) => {
        const imagesHtml = report.images && report.images.length > 0 ? `
          <div class="report-images" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin-top: 12px;">
            ${report.images.map(img => `
              <img src="${escapeHtml(img.data)}" alt="${escapeHtml(img.name)}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--line);" loading="lazy">
            `).join('')}
          </div>
        ` : '';
        
        return `<article class="report-item"><div class="report-top"><h3>${escapeHtml(report.title)}</h3>${badge(report.status)}</div><p class="report-meta">${escapeHtml(report.category)} · ${escapeHtml(report.location)} · ${dateLabel(report.createdAt)}</p><p class="report-description">${escapeHtml(report.description)}</p>${imagesHtml}<button class="detail-toggle" type="button" data-action="toggle-detail" data-detail-id="report-${escapeHtml(report.id)}-detail" aria-expanded="false" aria-controls="report-${escapeHtml(report.id)}-detail">View status timeline</button><div class="detail-panel" id="report-${escapeHtml(report.id)}-detail" hidden>${renderTimeline(report)}</div></article>`;
      }
    )
    .join("");
}
function renderTimeline(report) {
  const index = REPORT_STATUSES.indexOf(report.status);
  return `<div class="timeline">${REPORT_STATUSES.map((status, position) => `<div class="timeline-step ${position < index ? "complete" : ""} ${position === index ? "current" : ""}"><span class="timeline-dot">${position < index ? "✓" : position + 1}</span><span>${status}${position === index ? " · current status" : ""}</span></div>`).join("")}</div>`;
}
function renderQuestions(questions) {
  if (!questions.length)
    return `<div class="qa-empty">
      <svg class="qa-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <h3 class="qa-empty-title">No community questions yet</h3>
      <p class="qa-empty-text">Be the first to ask a question! Your question will be visible to the community and answered by barangay staff.</p>
      <button class="button qa-empty-action" type="button" data-action="toggle-question-form">+ Ask a question</button>
    </div>`;
  
  const sortedQuestions = [...questions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const userUpvotes = getUserUpvotes();
  
  return sortedQuestions.map((question) => {
    const isAnswered = !!question.answer;
    const cardClass = isAnswered ? 'qa-card answered' : 'qa-card unanswered';
    const isUpvoted = userUpvotes.includes(question.id);
    const upvoteClass = isUpvoted ? 'qa-upvote upvoted' : 'qa-upvote';
    const asker = householdFor(question.householdId);
    const askerName = asker ? asker.headName : "Unknown resident";
    const comments = question.comments || [];
    
    const commentsHtml = comments.length > 0 ? `
      <div class="qa-comments" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line);">
        ${comments.map(comment => {
          const commenter = householdFor(comment.householdId);
          const commenterName = commenter ? commenter.headName : "Unknown resident";
          return `
            <div class="qa-comment-item" style="display: flex; gap: 10px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line);">
              <div class="avatar" style="width: 32px; height: 32px; font-size: 11px; flex-shrink: 0;">${escapeHtml(initials(commenterName))}</div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                  <span style="font-weight: 600; font-size: 13px;">${escapeHtml(commenterName)}</span>
                  <span style="color: var(--muted); font-size: 11px;">${dateLabel(comment.createdAt)}</span>
                </div>
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: var(--ink);">${escapeHtml(comment.text)}</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';
    
    return `<article class="${cardClass}" data-question-id="${escapeHtml(question.id)}">
      <div class="qa-question">
        <span class="qa-question-label" aria-hidden="true">Q</span>
        <div class="qa-question-body">
          <div class="qa-author-row">
            <span class="qa-question-author">${escapeHtml(askerName)}</span>
            <span class="qa-dot-sep">·</span>
            <span class="qa-question-date">${dateLabel(question.createdAt)}</span>
          </div>
          <p class="qa-question-text">${escapeHtml(question.question)}</p>
        </div>
      </div>
      ${isAnswered ? `
        <div class="qa-answer">
          <span class="qa-answer-label" aria-hidden="true">A</span>
          <div class="qa-answer-content">
            <div class="qa-author-row">
              <span class="qa-answer-author">${escapeHtml(question.answeredBy)}</span>
              <span class="qa-dot-sep">·</span>
              <span class="qa-answer-date">${dateLabel(question.answeredAt || question.createdAt)}</span>
            </div>
            <p class="qa-answer-text">${escapeHtml(question.answer)}</p>
          </div>
        </div>
      ` : ``}
      ${commentsHtml}
      <div class="qa-meta">
        <div class="qa-meta-left">
          <button class="${upvoteClass}" type="button" data-action="upvote-question" data-question-id="${escapeHtml(question.id)}" aria-label="${question.upvotes} people liked this" aria-pressed="${isUpvoted}">
            <svg viewBox="0 0 24 24" fill="${isUpvoted ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
            <span>${question.upvotes}</span>
          </button>
          <button class="qa-comment" type="button" data-action="comment-question" data-question-id="${escapeHtml(question.id)}" aria-label="Comment on this question">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>Comment</span>
          </button>
        </div>
      </div>
      <form class="qa-comment-form" id="comment-form-${escapeHtml(question.id)}" data-question-id="${escapeHtml(question.id)}" data-action="submit-comment" hidden style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line);">
        <div class="field" style="margin: 0;">
          <textarea name="comment" placeholder="Write a comment..." rows="2" required style="min-height: 72px;"></textarea>
        </div>
        <div class="form-actions" style="justify-content: flex-end; margin-top: 8px;">
          <button type="button" class="button secondary compact" data-action="hide-comment-form" data-question-id="${escapeHtml(question.id)}">Cancel</button>
          <button type="submit" class="button compact">Post comment</button>
        </div>
      </form>
    </article>`;
  }).join("");
}

function renderStaff() {
  const navigation = staffNavigation();
  document.title = "Staff console · Barangay Connect";
  document.getElementById("app").innerHTML =
    `${topbar(session.user)}${portalNavigation(navigation, session.view)}<main id="main-content" class="page admin-page"><div class="admin-header"><div class="admin-header-row"><div><p class="eyebrow">Staff workspace · ${escapeHtml(session.user.office)}</p><h1 class="display-title">Barangay operations</h1><p>A focused view of resident concerns and payment records.</p></div><span class="admin-badge">Staff access</span></div></div><div class="admin-grid">${staffView(session.view)}</div></main>`;
}
function staffView(view) {
  if (view === "queue") return renderReportQueue();
  if (view === "billing") return renderBillingRecords();
  if (view === "questions") return renderStaffQuestions();
  const outstandingCount = outstandingBillingRecords(state).length;
  return `${renderStats()}<section class="card"><div class="card-header"><div><h2>Today’s work</h2><p>Start with reports that are waiting for a response.</p></div><button class="button compact" type="button" data-action="navigate" data-view="queue">Open report queue</button></div><div class="card-body"><div class="list"><div class="list-row"><div class="list-row-main"><strong>${state.reports.filter((report) => report.status === "Submitted").length} new reports need acknowledgement</strong><p>Submitted reports are shown first.</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="queue">Review</button></div><div class="list-row"><div class="list-row-main"><strong>${outstandingCount} outstanding billing record${outstandingCount === 1 ? "" : "s"}</strong><p>Update payment status after off-platform payment is confirmed.</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="billing">View records</button></div></div></div></section>`;
}
function renderStats() {
  const weekAgo = new Date("2026-09-17T12:00:00");
  const monthStart = new Date("2026-09-01T12:00:00");
  const newThisWeek = state.reports.filter(
    (report) => new Date(`${report.createdAt}T12:00:00`) >= weekAgo,
  ).length;
  const inProgress = state.reports.filter(
    (report) => report.status === "In Progress",
  ).length;
  const resolvedThisMonth = state.reports.filter(
    (report) =>
      report.status === "Resolved" &&
      new Date(`${report.updatedAt}T12:00:00`) >= monthStart,
  ).length;
  const responseReports = state.reports.filter(
    (report) =>
      report.status !== "Submitted" && report.updatedAt !== report.createdAt,
  );
  const totalHours = responseReports.reduce(
    (sum, report) =>
      sum +
      (new Date(`${report.updatedAt}T12:00:00`) -
        new Date(`${report.createdAt}T12:00:00`)) /
        3600000,
    0,
  );
  const average = responseReports.length
    ? Math.round(totalHours / responseReports.length)
    : 0;
  return `<section class="card" id="stats"><div class="card-header"><div><h2>Report summary</h2><p>As of September 24, 2026</p></div></div><div class="card-body"><div class="stats-grid"><div class="stat-card"><span class="stat-value">${newThisWeek}</span><span class="stat-label">New this week</span></div><div class="stat-card"><span class="stat-value">${inProgress}</span><span class="stat-label">In progress</span></div><div class="stat-card"><span class="stat-value">${average}h</span><span class="stat-label">Average response</span></div><div class="stat-card"><span class="stat-value">${resolvedThisMonth}</span><span class="stat-label">Resolved this month</span></div></div></div></section>`;
}
function renderReportQueue() {
  const filter = session.reportFilter || "All statuses";
  return `<section class="card" id="report-queue"><div class="card-header"><div><h2>Report queue</h2><p>Move a report through the barangay response workflow.</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="home">Back to overview</button></div><div class="toolbar"><span class="toolbar-label">${state.reports.length} total reports</span><select class="filter-select" data-action="report-filter" aria-label="Filter reports by status"><option>All statuses</option>${REPORT_STATUSES.map((status) => `<option ${filter === status ? "selected" : ""}>${status}</option>`).join("")}</select></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Issue</th><th>Category</th><th>Resident</th><th>Received</th><th>Status control</th></tr></thead><tbody>${renderReportRows(filter)}</tbody></table></div></section>`;
}
function renderReportRows(filter) {
  const reports = [...state.reports].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const visible =
    filter === "All statuses"
      ? reports
      : reports.filter((report) => report.status === filter);
  if (!visible.length)
    return '<tr><td class="table-empty" colspan="5">No reports match this filter.</td></tr>';
  return visible
    .map((report) => {
      const household = householdFor(report.householdId);
      return `<tr><td><strong>${escapeHtml(report.title)}</strong><span class="cell-secondary">${escapeHtml(report.location)}</span></td><td>${escapeHtml(report.category)}</td><td>${escapeHtml(household?.headName || "Unknown")}</td><td>${dateLabel(report.createdAt)}</td><td><select class="status-control status-${statusTone(report.status)}" data-report-status="${escapeHtml(report.id)}" aria-label="Status for ${escapeHtml(report.title)}">${REPORT_STATUSES.map((status) => `<option ${status === report.status ? "selected" : ""}>${status}</option>`).join("")}</select></td></tr>`;
    })
    .join("");
}
function renderBillingRecords() {
  const records = outstandingBillingRecords(state);
  return `<section class="card" id="billing-records"><div class="card-header"><div><h2>Billing records</h2><p>Mark a record paid after confirming payment received elsewhere.</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="home">Back to overview</button></div><div class="toolbar"><span class="toolbar-label">${records.length} outstanding record${records.length === 1 ? "" : "s"}</span><div></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Household</th><th>Type</th><th>Period</th><th>Amount due</th><th>Status</th><th>Update status</th></tr></thead><tbody>${renderBillingRows(records)}</tbody></table></div></section>`;
}
function renderBillingRows(records) {
  if (!records.length)
    return '<tr><td class="table-empty" colspan="6">All billing records are marked paid.</td></tr>';
  return records
    .map(({ type, record }) => {
      const household = householdFor(record.householdId);
      const isWater = type === "water";
      const label = isWater ? record.period : `${record.year} annual tax`;
      const dueDate = isWater ? record.dueDate : record.dueDate;
      const status = isWater ? effectiveBillStatus(record) : "Unpaid";
      const amount = isWater ? record.amountDue : calculateTax(record).total;
      return `<tr><td><strong>${escapeHtml(household?.headName || "Unknown")}</strong><span class="cell-secondary">${escapeHtml(household?.accountNumber || "")} · ${escapeHtml(household?.address || "")}</span></td><td>${isWater ? "Water" : "Property tax"}</td><td>${escapeHtml(label)}<span class="cell-secondary">Due ${dateLabel(dueDate)}</span></td><td><strong>${money(amount)}</strong></td><td>${badge(status)}</td><td><button class="table-action" type="button" data-payment-type="${type}" data-payment-id="${escapeHtml(record.id)}" data-confirm="Mark this ${isWater ? "water" : "property tax"} record as paid?">Mark paid</button></td></tr>`;
    })
    .join("");
}
function renderStaffQuestions() {
  return `<section class="card" id="staff-questions"><div class="card-header"><div><h2>Answer questions</h2><p>Pending questions are the only items that need a response.</p></div><button class="button secondary compact" type="button" data-action="navigate" data-view="home">Back to overview</button></div><div class="card-body"><div class="list">${
    state.questions
      .filter((question) => !question.answer)
      .map(renderStaffQuestion)
      .join("") ||
    '<p class="empty">All community questions have been answered.</p>'
  }</div></div></section>`;
}
function renderStaffQuestion(question) {
  const household = householdFor(question.householdId);
  return `<article class="report-item"><div class="report-top"><h3>${escapeHtml(question.question)}</h3>${badge("Pending")}</div><p class="report-meta">${escapeHtml(household?.headName || "Unknown household")} · ${dateLabel(question.createdAt)}</p><form class="inline-form qa-form" data-question-id="${escapeHtml(question.id)}"><textarea name="answer" placeholder="Write a clear, resident-friendly answer" maxlength="1000" required></textarea><button class="button compact" type="submit">Post answer</button></form></article>`;
}

function portalNavigation(navigation, currentView) {
  return `<nav class="portal-nav" aria-label="Portal navigation"><div class="page portal-nav-inner">${navigation.map(([view, label]) => `<button class="portal-nav-item ${view === currentView ? "active" : ""}" type="button" data-action="navigate" data-view="${view}"${view === currentView ? ' aria-current="page"' : ""}>${label}</button>`).join("")}</div></nav>`;
}
const app = document.getElementById("app");
app.addEventListener("click", (event) => {
  if (isResident()) handleResidentClick(event);
  else if (isStaff()) handleStaffClick(event);
});
app.addEventListener("change", (event) => {
  if (isResident()) handleResidentChange(event);
  else if (isStaff()) handleStaffChange(event);
});
app.addEventListener("submit", (event) => {
  if (isResident()) handleResidentSubmit(event);
  else if (isStaff()) handleStaffSubmit(event);
});
function handleResidentClick(event) {
  const button = event.target.closest?.("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "logout") {
    logout();
    return;
  }
  if (action === "navigate") {
    session.view = button.dataset.view;
    renderResident();
    return;
  }
  if (action === "toggle-report-form") {
    const form = document.getElementById("report-form");
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("input")?.focus();
    return;
  }
  if (action === "hide-report-form") {
    const form = document.getElementById("report-form");
    if (!form) return;
    form.hidden = true;
    return;
  }
  if (action === "toggle-question-form") {
    const form = document.getElementById("question-form");
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("textarea")?.focus();
    return;
  }
  if (action === "hide-question-form") {
    const form = document.getElementById("question-form");
    if (!form) return;
    form.hidden = true;
    return;
  }
  if (action === "toggle-detail") {
    const panel = document.getElementById(button.dataset.detailId);
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    return;
  }
  if (action === "remove-image") {
    const fileInput = document.getElementById("report-images");
    const fileName = button.dataset.name;
    if (fileInput && fileName) {
      const dt = new DataTransfer();
      Array.from(fileInput.files).forEach(file => {
        if (file.name !== fileName) dt.items.add(file);
      });
      fileInput.files = dt.files;
      // Trigger change event to update preview
      fileInput.dispatchEvent(new Event("change"));
    }
    return;
  }
  if (action === "upvote-question") {
    const questionId = button.dataset.questionId;
    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;
    
    // Toggle upvote with localStorage persistence
    const isUpvoted = hasUserUpvoted(questionId);
    toggleUserUpvote(questionId);
    const newUpvotes = isUpvoted ? question.upvotes - 1 : question.upvotes + 1;
    
    const updatedQuestions = state.questions.map(q => 
      q.id === questionId ? { ...q, upvotes: newUpvotes } : q
    );
    
    if (!commitState({ ...state, questions: updatedQuestions })) return;
    renderResident();
    return;
  }
  if (action === "comment-question") {
    const questionId = button.dataset.questionId;
    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;
    
    // Toggle comment form visibility
    const commentForm = document.getElementById(`comment-form-${questionId}`);
    if (commentForm) {
      commentForm.hidden = !commentForm.hidden;
      if (!commentForm.hidden) {
        commentForm.querySelector("textarea")?.focus();
      }
    }
    return;
  }
  if (action === "hide-comment-form") {
    const questionId = button.dataset.questionId;
    const commentForm = document.getElementById(`comment-form-${questionId}`);
    if (commentForm) commentForm.hidden = true;
    return;
  }
}
function handleResidentChange(event) {
  if (event.target.matches('[data-action="report-filter"]'))
    session.reportFilter = event.target.value;
  
  // Handle image preview for report form
  if (event.target.id === "report-images") {
    const fileInput = event.target;
    const files = Array.from(fileInput.files).slice(0, 5);
    const previewContainer = document.getElementById("report-image-preview");
    if (previewContainer) {
      previewContainer.innerHTML = files.map(file => `
        <div class="image-preview-item" style="position: relative; width: 100px; height: 100px; flex-shrink: 0;">
          <img src="${URL.createObjectURL(file)}" alt="${escapeHtml(file.name)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--line);">
          <button type="button" class="remove-image" data-name="${escapeHtml(file.name)}" style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: var(--red); color: white; border: none; cursor: pointer; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
      `).join('');
    }
  }
}
function handleResidentSubmit(event) {
  const form = event.target;
  if (form.id === "issue-form") submitIssue(event);
  if (form.id === "qa-form") submitQuestion(event);
  if (form.dataset.action === "submit-comment") {
    event.preventDefault();
    const questionId = form.dataset.questionId;
    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;
    
    const commentText = new FormData(form).get("comment")?.toString().trim();
    if (!commentText) return;
    
    const newComment = {
      id: `c${Date.now()}`,
      householdId: session.user.id,
      text: commentText,
      createdAt: AS_OF_DATE,
    };
    
    const updatedQuestions = state.questions.map(q => {
      if (q.id === questionId) {
        const comments = q.comments || [];
        return { ...q, comments: [...comments, newComment] };
      }
      return q;
    });
    
    if (!commitState({ ...state, questions: updatedQuestions })) return;
    renderResident();
    return;
  }
}
async function submitIssue(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const values = Object.fromEntries(formData);
  if (
    !values.title?.trim() ||
    !values.description?.trim() ||
    !values.location?.trim() ||
    !values.category
  ) {
    showFormError("report-error", "Please complete each required field.");
    return;
  }
  
  // Handle image uploads
  const imageFiles = formData.getAll("images");
  const images = [];
  const maxImages = 5;
  
  for (let i = 0; i < Math.min(imageFiles.length, maxImages); i++) {
    const file = imageFiles[i];
    if (file && file.type.startsWith("image/")) {
      // Convert to base64 for storage
      const base64 = await fileToBase64(file);
      images.push({
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64,
      });
    }
  }
  
  const report = {
    id: `r${Date.now()}`,
    householdId: session.user.id,
    title: values.title.trim(),
    description: values.description.trim(),
    location: values.location.trim(),
    category: values.category,
    status: "Submitted",
    createdAt: AS_OF_DATE,
    updatedAt: AS_OF_DATE,
    images: images,
  };
  if (!commitState({ ...state, reports: [report, ...state.reports] })) return;
  renderResident();
  showToast("Report submitted. You can follow its status here.");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function submitQuestion(event) {
  event.preventDefault();
  const form = event.target;
  const question = new FormData(form).get("question")?.toString().trim();
  if (!question) {
    showFormError("question-error", "Please write your question first.");
    return;
  }
  const newQuestion = {
    id: `q${Date.now()}`,
    householdId: session.user.id,
    question,
    answer: "",
    answeredBy: "",
    upvotes: 0,
    createdAt: AS_OF_DATE,
  };
  if (!commitState({ ...state, questions: [newQuestion, ...state.questions] }))
    return;
  renderResident();
  showToast("Question posted for the barangay team.");
}
function handleStaffClick(event) {
  const button = event.target.closest?.("[data-action]");
  if (button?.dataset.action === "logout") {
    logout();
    return;
  }
  if (button?.dataset.action === "navigate") {
    session.view = button.dataset.view;
    renderStaff();
    return;
  }
  const paymentButton = event.target.closest?.("[data-payment-type]");
  if (paymentButton) {
    if (!window.confirm(paymentButton.dataset.confirm)) return;
    const type = paymentButton.dataset.paymentType;
    let nextState;
    try {
      nextState = markBillingRecordPaid(
        state,
        type,
        paymentButton.dataset.paymentId,
        AS_OF_DATE,
      );
    } catch (error) {
      console.error(error);
      showToast("Could not update this billing record.", true);
      return;
    }
    if (!commitState(nextState)) return;
    renderStaff();
    showToast(`${type === "water" ? "Water" : "Tax"} record marked as paid.`);
  }
}
function handleStaffChange(event) {
  const select = event.target.closest("[data-report-status]");
  if (select) {
    const report = state.reports.find(
      (item) => item.id === select.dataset.reportStatus,
    );
    if (report) {
      const reports = state.reports.map((item) =>
        item.id === report.id
          ? { ...item, status: select.value, updatedAt: AS_OF_DATE }
          : item,
      );
      if (!commitState({ ...state, reports })) return;
      renderStaff();
      showToast(`Report moved to ${select.value}.`);
    }
    return;
  }
  if (event.target.matches('[data-action="report-filter"]')) {
    session.reportFilter = event.target.value;
    renderStaff();
  }
}
function handleStaffSubmit(event) {
  const form = event.target.closest("[data-question-id]");
  if (!form) return;
  event.preventDefault();
  const answer = new FormData(form).get("answer")?.toString().trim();
  if (!answer) return;
  const question = state.questions.find(
    (item) => item.id === form.dataset.questionId,
  );
  if (question) {
    const questions = state.questions.map((item) =>
      item.id === question.id
        ? { ...item, answer, answeredBy: session.user.name, answeredAt: AS_OF_DATE }
        : item,
    );
    if (!commitState({ ...state, questions })) return;
    renderStaff();
    showToast("Answer posted to the community Q&A.");
  }
}
function showFormError(id, message) {
  const element = document.getElementById(id);
  element.textContent = message;
  element.hidden = false;
}
function commitState(nextState) {
  try {
    state = stateStore.commit(nextState);
    return true;
  } catch (error) {
    console.error(error);
    showToast("Unable to save changes. Your previous data is unchanged.", true);
    return false;
  }
}
function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.toggle("error", isError);
  element.setAttribute("role", isError ? "alert" : "status");
  element.setAttribute("aria-live", isError ? "assertive" : "polite");
  element.hidden = false;
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 3600);
}

function renderStateError() {
  document.title = "Portal data unavailable · Barangay Connect";
  app.innerHTML = `<main id="main-content" class="page portal-page"><section class="card"><div class="card-header"><div><h1>Portal data unavailable</h1><p role="alert">Saved portal data could not be loaded. It has not been overwritten. Check browser storage or restore valid saved data before retrying.</p></div></div></section></main>`;
}

try {
  state = stateStore.load();
  renderLogin();
} catch (error) {
  console.error(error);
  renderStateError();
}
