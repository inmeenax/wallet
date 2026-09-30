const WORKER_BASE =
  "https://watchpays-api1.moxoga3282.workers.dev";

const CREATE_PAYMENT_URL =
  `${WORKER_BASE}/create-payment`;

const TRANSACTIONS_URL =
  `${WORKER_BASE}/transactions`;

const WEBSITE_URL =
  "https://inmeenax.github.io/wallet/";

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 100000;

const walletPage = document.getElementById("walletPage");
const paymentLoading = document.getElementById("paymentLoading");

const amountInput = document.getElementById("amountInput");
const linkForm = document.getElementById("linkForm");

const generatedLinkBox =
  document.getElementById("generatedLinkBox");

const generatedLinkText =
  document.getElementById("generatedLinkText");

const copyGeneratedLink =
  document.getElementById("copyGeneratedLink");

const copyMessage =
  document.getElementById("copyMessage");

const totalBalance =
  document.getElementById("totalBalance");

const successCount =
  document.getElementById("successCount");

const transactionCount =
  document.getElementById("transactionCount");

const transactionsList =
  document.getElementById("transactionsList");

const refreshButton =
  document.getElementById("refreshButton");

const lastUpdated =
  document.getElementById("lastUpdated");

const loadingAmount =
  document.getElementById("loadingAmount");

const loadingTitle =
  document.getElementById("loadingTitle");

const loadingText =
  document.getElementById("loadingText");

const progressBar =
  document.getElementById("progressBar");

const loadingError =
  document.getElementById("loadingError");

const loadingBackButton =
  document.getElementById("loadingBackButton");

const loadingSteps = {
  1: document.getElementById("step1"),
  2: document.getElementById("step2"),
  3: document.getElementById("step3")
};


/* -----------------------------
   HELPERS
----------------------------- */

function formatMoney(value) {
  const number = Number(value) || 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}


function formatDateTime(value) {
  if (!value) {
    return "Time unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}


function normalizeAmount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (number < MIN_AMOUNT || number > MAX_AMOUNT) {
    return null;
  }

  return number.toFixed(2);
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* -----------------------------
   LOADING UI
----------------------------- */

function showLoading(amount) {
  walletPage.classList.add("hidden");
  paymentLoading.classList.remove("hidden");

  loadingError.classList.add("hidden");
  loadingBackButton.classList.add("hidden");

  loadingTitle.textContent =
    "Preparing your payment";

  loadingText.textContent =
    "Creating a secure payment request...";

  loadingAmount.textContent =
    formatMoney(amount);

  progressBar.style.width = "18%";

  setLoadingStep(1);
}


function setLoadingStep(step) {

  Object.values(loadingSteps).forEach((element) => {
    element.classList.remove("active");
    element.classList.remove("done");
  });

  for (let i = 1; i < step; i++) {
    loadingSteps[i].classList.add("done");
  }

  loadingSteps[step].classList.add("active");

  const progress = {
    1: 20,
    2: 58,
    3: 90
  };

  progressBar.style.width =
    `${progress[step]}%`;

  if (step === 1) {
    loadingText.textContent =
      "Creating a secure payment request...";
  }

  if (step === 2) {
    loadingText.textContent =
      "Connecting to WatchPays gateway...";
  }

  if (step === 3) {
    loadingText.textContent =
      "Payment gateway is ready. Redirecting...";
  }
}


function showLoadingError(message) {

  loadingTitle.textContent =
    "Payment could not be created";

  loadingText.textContent =
    "Please check the details and try again.";

  loadingError.textContent =
    message || "Something went wrong.";

  loadingError.classList.remove("hidden");

  loadingBackButton.classList.remove("hidden");

  progressBar.style.width = "100%";

  Object.values(loadingSteps).forEach((element) => {
    element.classList.remove("active");
  });
}


/* -----------------------------
   CREATE PAYMENT
----------------------------- */

async function createPayment(amount) {

  const normalizedAmount =
    normalizeAmount(amount);

  if (!normalizedAmount) {
    showLoadingError(
      `Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}.`
    );
    return;
  }

  showLoading(normalizedAmount);

  try {

    const response = await fetch(
      CREATE_PAYMENT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Number(normalizedAmount)
        })
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Worker returned an invalid response."
      );
    }

    if (
      !response.ok ||
      !data.success ||
      !data.payment_url
    ) {
      throw new Error(
        data.error ||
        data.message ||
        "WatchPays payment creation failed."
      );
    }

    setLoadingStep(2);

    await new Promise(resolve =>
      setTimeout(resolve, 450)
    );

    setLoadingStep(3);

    await new Promise(resolve =>
      setTimeout(resolve, 600)
    );

    window.location.href =
      data.payment_url;

  } catch (error) {

    console.error(
      "Payment creation error:",
      error
    );

    showLoadingError(
      error.message ||
      "Unable to create payment."
    );
  }
}


/* -----------------------------
   GENERATE LINK
----------------------------- */

function generatePaymentLink(amount) {

  const normalizedAmount =
    normalizeAmount(amount);

  if (!normalizedAmount) {
    return;
  }

  const link =
    `${WEBSITE_URL}?amount=${encodeURIComponent(
      Number(normalizedAmount)
    )}`;

  generatedLinkText.textContent =
    link;

  generatedLinkBox.classList.remove(
    "hidden"
  );

  copyMessage.textContent = "";

  generatedLinkBox.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}


linkForm.addEventListener(
  "submit",
  (event) => {

    event.preventDefault();

    const amount =
      amountInput.value.trim();

    const normalized =
      normalizeAmount(amount);

    if (!normalized) {

      amountInput.focus();

      amountInput.setCustomValidity(
        `Enter an amount between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}.`
      );

      amountInput.reportValidity();

      return;
    }

    amountInput.setCustomValidity("");

    generatePaymentLink(normalized);
  }
);


copyGeneratedLink.addEventListener(
  "click",
  async () => {

    const link =
      generatedLinkText.textContent;

    if (!link || link === "—") {
      return;
    }

    try {

      await navigator.clipboard.writeText(link);

      copyMessage.textContent =
        "✓ Payment link copied.";

      copyGeneratedLink.textContent =
        "Copied";

      setTimeout(() => {
        copyGeneratedLink.textContent =
          "Copy";
      }, 1400);

    } catch {

      copyMessage.textContent =
        "Copy failed. Please copy the link manually.";
    }
  }
);


/* -----------------------------
   QUICK PAYMENTS
----------------------------- */

document
  .querySelectorAll(".quick-amount")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const amount =
          button.dataset.amount;

        createPayment(amount);
      }
    );

  });


/* -----------------------------
   TRANSACTIONS
----------------------------- */

async function loadTransactions() {

  try {

    const response =
      await fetch(
        TRANSACTIONS_URL,
        {
          method: "GET",
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "Could not load transactions."
      );
    }

    const data =
      await response.json();

    if (!data.success) {
      throw new Error(
        data.error ||
        "Could not load transactions."
      );
    }

    renderTransactions(
      data.transactions || []
    );

  } catch (error) {

    console.error(
      "Transaction loading error:",
      error
    );

  } finally {

    lastUpdated.textContent =
      "Updated " +
      new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }).format(new Date());
  }
}


function renderTransactions(
  transactions
) {

  let balance = 0;
  let successful = 0;

  transactions.forEach(transaction => {

    if (
      String(transaction.status)
        .toLowerCase() === "success"
    ) {

      balance +=
        Number(transaction.amount) || 0;

      successful++;
    }
  });

  totalBalance.textContent =
    formatMoney(balance);

  successCount.textContent =
    `${successful} successful payment${
      successful === 1 ? "" : "s"
    }`;

  transactionCount.textContent =
    transactions.length;

  if (!transactions.length) {

    transactionsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">₹</div>
        <h3>No transactions yet</h3>
        <p>
          Payments created from this wallet
          will appear here.
        </p>
      </div>
    `;

    return;
  }

  transactionsList.innerHTML =
    transactions
      .map(transaction => {

        const status =
          String(
            transaction.status || "pending"
          ).toLowerCase();

        const safeStatus =
          ["success", "pending", "failed"]
            .includes(status)
            ? status
            : "pending";

        const icon =
          safeStatus === "success"
            ? "✓"
            : safeStatus === "failed"
              ? "!"
              : "•";

        const statusText =
          safeStatus.toUpperCase();

        const displayTime =
          safeStatus === "success" &&
          transaction.successAt
            ? transaction.successAt
            : transaction.createdAt;

        const order =
          transaction.merchantOrderNo ||
          "Order unavailable";

        return `
          <article class="transaction">

            <div class="transaction-icon ${safeStatus}">
              ${icon}
            </div>

            <div class="transaction-main">

              <div class="transaction-top">

                <div class="transaction-amount">
                  ${escapeHtml(
                    formatMoney(transaction.amount)
                  )}
                </div>

                <div class="transaction-status ${safeStatus}">
                  ${statusText}
                </div>

              </div>

              <div class="transaction-time">
                ${escapeHtml(
                  formatDateTime(displayTime)
                )}
              </div>

              <div class="transaction-order">
                ${escapeHtml(order)}
              </div>

            </div>

          </article>
        `;
      })
      .join("");
}


/* -----------------------------
   REFRESH / POLLING
----------------------------- */

refreshButton.addEventListener(
  "click",
  async () => {

    refreshButton.style.transform =
      "rotate(360deg)";

    await loadTransactions();

    setTimeout(() => {
      refreshButton.style.transform = "";
    }, 300);
  }
);


// Refresh every 5 seconds so pending
// payments can change to SUCCESS.
setInterval(
  loadTransactions,
  5000
);


/* -----------------------------
   DIRECT PAYMENT LINK
----------------------------- */

function checkDirectPayment() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const amount =
    params.get("amount");

  if (!amount) {
    return false;
  }

  const normalized =
    normalizeAmount(amount);

  if (!normalized) {

    showLoading(amount);

    showLoadingError(
      `Invalid payment amount. Use ₹${MIN_AMOUNT} to ₹${MAX_AMOUNT}.`
    );

    return true;
  }

  createPayment(normalized);

  return true;
}


/* -----------------------------
   BACK BUTTON
----------------------------- */

loadingBackButton.addEventListener(
  "click",
  () => {

    paymentLoading.classList.add(
      "hidden"
    );

    walletPage.classList.remove(
      "hidden"
    );

    history.replaceState(
      {},
      document.title,
      WEBSITE_URL
    );

    loadTransactions();
  }
);


/* -----------------------------
   START
----------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    loadTransactions();

    checkDirectPayment();

  }
);
