const WORKER_BASE =
  "https://watchpays-api1.moxoga3282.workers.dev";

const WORKER_PAYMENT_URL =
  WORKER_BASE + "/create-payment";

const WEBSITE_URL =
  "https://inmeenax.github.io/trash/";

const ALLOWED_AMOUNTS = [
  100,
  200,
  300,
  400,
  500
];


// =====================================================
// PAYMENT
// =====================================================

async function createPayment(amount) {

  showLoading(amount);

  try {

    setLoadingStep(1);

    const response =
      await fetch(
        WORKER_PAYMENT_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              amount
            })
        }
      );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success ||
      !data.payment_url
    ) {

      throw new Error(
        data.error ||
        "Payment creation failed"
      );
    }


    setLoadingStep(2);


    setTimeout(() => {

      setLoadingStep(3);

    }, 250);


    setTimeout(() => {

      window.location.href =
        data.payment_url;

    }, 650);


  } catch (error) {

    hideLoading();

    alert(
      error.message ||
      "Payment failed"
    );
  }
}


// =====================================================
// COPY PAYMENT LINK
// =====================================================

async function copyPaymentLink(amount) {

  const paymentLink =
    WEBSITE_URL +
    "?amount=" +
    amount;


  try {

    await navigator.clipboard.writeText(
      paymentLink
    );


    alert(
      "Payment link copied!"
    );

  } catch {

    prompt(
      "Copy this payment link:",
      paymentLink
    );
  }
}


// =====================================================
// WITHDRAWAL
// =====================================================

async function submitWithdrawal(event) {

  event.preventDefault();


  const amount =
    Number(
      document.getElementById(
        "withdrawAmount"
      ).value
    );


  const name =
    document.getElementById(
      "accountName"
    ).value.trim();


  const accountNumber =
    document.getElementById(
      "accountNumber"
    ).value.trim();


  const ifsc =
    document.getElementById(
      "ifsc"
    ).value.trim()
    .toUpperCase();


  const bankName =
    document.getElementById(
      "bankName"
    ).value.trim();


  const button =
    document.getElementById(
      "withdrawButton"
    );


  const message =
    document.getElementById(
      "withdrawMessage"
    );


  hideMessage();


  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {

    showMessage(
      "Please enter a valid amount.",
      "error"
    );

    return;
  }


  if (!name) {

    showMessage(
      "Please enter account holder name.",
      "error"
    );

    return;
  }


  if (!accountNumber) {

    showMessage(
      "Please enter account number.",
      "error"
    );

    return;
  }


  if (!ifsc) {

    showMessage(
      "Please enter IFSC.",
      "error"
    );

    return;
  }


  if (!bankName) {

    showMessage(
      "Please enter bank name.",
      "error"
    );

    return;
  }


  button.disabled =
    true;

  button.textContent =
    "Processing...";


  try {

    const response =
      await fetch(
        WORKER_BASE +
        "/create-payout",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              amount,

              name,

              account_number:
                accountNumber,

              ifsc,

              bank_name:
                bankName
            })
          }
        );


    const data =
      await response.json();


    if (
      !response.ok ||
      !data.success
    ) {

      throw new Error(
        data.error ||
        "Withdrawal failed"
      );
    }


    showMessage(
      `Withdrawal request submitted. ₹${Number(data.amount).toFixed(2)} is pending.`,
      "success"
    );


    document
      .getElementById(
        "withdrawForm"
      )
      .reset();


    await loadWallet();


  } catch (error) {

    showMessage(
      error.message ||
      "Withdrawal failed.",
      "error"
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      "Withdraw Money";
  }
}


// =====================================================
// LOAD WALLET
// =====================================================

async function loadWallet() {

  try {

    const response =
      await fetch(
        WORKER_BASE +
        "/transactions"
      );


    const data =
      await response.json();


    if (!data.success) {
      return;
    }


    document
      .getElementById(
        "balance"
      )
      .textContent =
      formatMoney(
        data.balance
      );


    document
      .getElementById(
        "totalDeposits"
      )
      .textContent =
      formatMoney(
        data.totalDeposits
      );


    document
      .getElementById(
        "totalWithdrawals"
      )
      .textContent =
      formatMoney(
        data.totalWithdrawals
      );


    renderTransactions(
      data.transactions || []
    );


  } catch (error) {

    console.error(
      "Wallet load error:",
      error
    );
  }
}


// =====================================================
// LOAD WITHDRAWALS
// =====================================================

async function loadWithdrawals() {

  try {

    const response =
      await fetch(
        WORKER_BASE +
        "/withdrawals"
      );


    const data =
      await response.json();


    if (!data.success) {
      return;
    }


    renderWithdrawals(
      data.withdrawals || []
    );


  } catch (error) {

    console.error(
      "Withdrawal load error:",
      error
    );
  }
}


// =====================================================
// RENDER DEPOSITS
// =====================================================

function renderTransactions(
  transactions
) {

  const container =
    document.getElementById(
      "transactions"
    );


  if (!transactions.length) {

    container.innerHTML =
      `<div class="empty">
        No transactions yet.
      </div>`;

    return;
  }


  container.innerHTML =
    transactions
      .map(transaction => {

        const status =
          String(
            transaction.status ||
            "PENDING"
          ).toUpperCase();


        return `
          <div class="transaction">

            <div class="transaction-top">

              <div>

                <div class="transaction-amount">
                  +${formatMoney(transaction.amount)}
                </div>

              </div>

              ${statusBadge(status)}

            </div>

            <div class="transaction-meta">

              Order:
              ${escapeHtml(
                transaction.merchant_order_no || "-"
              )}

              <br>

              ${formatDate(
                transaction.successAt ||
                transaction.createdAt
              )}

            </div>

          </div>
        `;

      })
      .join("");
}


// =====================================================
// RENDER WITHDRAWALS
// =====================================================

function renderWithdrawals(
  withdrawals
) {

  const container =
    document.getElementById(
      "withdrawals"
    );


  if (!withdrawals.length) {

    container.innerHTML =
      `<div class="empty">
        No withdrawals yet.
      </div>`;

    return;
  }


  container.innerHTML =
    withdrawals
      .map(withdrawal => {

        const status =
          String(
            withdrawal.status ||
            "PENDING"
          ).toUpperCase();


        const amount =
          Number(
            withdrawal.amount || 0
          );


        const fee =
          Number(
            withdrawal.fee || 0
          );


        const total =
          Number(
            withdrawal.total_amount ||
            amount + fee
          );


        return `
          <div class="transaction">

            <div class="transaction-top">

              <div>

                <div class="transaction-amount">
                  -${formatMoney(amount)}
                </div>

              </div>

              ${statusBadge(status)}

            </div>


            <div class="transaction-meta">

              ${escapeHtml(
                withdrawal.bank_name || "-"
              )}

              ••••

              ${escapeHtml(
                withdrawal.account_last4 || "----"
              )}

              <br>

              Fee:
              ${formatMoney(fee)}

              <br>

              Total deducted:
              ${formatMoney(total)}

              <br>

              ${formatDate(
                withdrawal.successAt ||
                withdrawal.failedAt ||
                withdrawal.createdAt
              )}

              <br>

              Transaction:
              ${escapeHtml(
                withdrawal.transaction_id || "-"
              )}

            </div>

          </div>
        `;

      })
      .join("");
}


// =====================================================
// STATUS BADGE
// =====================================================

function statusBadge(status) {

  let css =
    "pending";

  let text =
    "PENDING";


  if (
    status === "SUCCESS"
  ) {

    css =
      "success";

    text =
      "✓ SUCCESS";
  }


  if (
    status === "FAILED"
  ) {

    css =
      "failed";

    text =
      "✕ FAILED";
  }


  return `
    <span class="status ${css}">
      ${text}
    </span>
  `;
}


// =====================================================
// FORMAT MONEY
// =====================================================

function formatMoney(
  value
) {

  const number =
    Number(value || 0);


  return number.toLocaleString(
    "en-IN",
    {
      style:
        "currency",

      currency:
        "INR",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2
    }
  );
}


// =====================================================
// FORMAT DATE + TIME
// =====================================================

function formatDate(
  value
) {

  if (!value) {
    return "-";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;
  }


  return date.toLocaleString(
    "en-IN",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",

      hour12:
        true
    }
  );
}


// =====================================================
// LOADING SCREEN
// =====================================================

function showLoading(
  amount
) {

  const screen =
    document.getElementById(
      "loadingScreen"
    );


  document
    .getElementById(
      "loadingAmount"
    )
    .textContent =
    formatMoney(amount);


  screen.classList.remove(
    "hidden"
  );


  setLoadingStep(0);
}


function hideLoading() {

  document
    .getElementById(
      "loadingScreen"
    )
    .classList.add(
      "hidden"
    );
}


function setLoadingStep(
  step
) {

  const progress =
    document.getElementById(
      "progressBar"
    );


  const step1 =
    document.getElementById(
      "step1"
    );


  const step2 =
    document.getElementById(
      "step2"
    );


  const step3 =
    document.getElementById(
      "step3"
    );


  step1.classList.remove(
    "done"
  );

  step2.classList.remove(
    "done"
  );

  step3.classList.remove(
    "done"
  );


  if (step >= 1) {

    step1.textContent =
      "✓ Creating payment request";

    step1.classList.add(
      "done"
    );

  } else {

    step1.textContent =
      "○ Creating payment request";
  }


  if (step >= 2) {

    step2.textContent =
      "✓ Connecting to gateway";

    step2.classList.add(
      "done"
    );

  } else {

    step2.textContent =
      "○ Connecting to gateway";
  }


  if (step >= 3) {

    step3.textContent =
      "✓ Redirecting securely";

    step3.classList.add(
      "done"
    );

  } else {

    step3.textContent =
      "○ Redirecting securely";
  }


  progress.style.width =
    `${Math.max(
      10,
      step * 33
    )}%`;
}


// =====================================================
// MESSAGE
// =====================================================

function showMessage(
  text,
  type
) {

  const message =
    document.getElementById(
      "withdrawMessage"
    );


  message.textContent =
    text;


  message.className =
    `message show ${type}`;
}


function hideMessage() {

  const message =
    document.getElementById(
      "withdrawMessage"
    );


  message.className =
    "message";
}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(
  value
) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// DIRECT PAYMENT LINK
// =====================================================

function checkDirectPayment() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const amount =
    Number(
      params.get("amount")
    );


  if (
    ALLOWED_AMOUNTS.includes(
      amount
    )
  ) {

    createPayment(amount);
  }
}


// =====================================================
// INITIAL LOAD
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    checkDirectPayment();

    await loadWallet();

    await loadWithdrawals();

  }
);


// =====================================================
// AUTO REFRESH
// =====================================================

setInterval(
  async () => {

    await loadWallet();

    await loadWithdrawals();

  },
  5000
);
