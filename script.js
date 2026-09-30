const WATCHPAYS_CREATE_URL =
  "https://api.watchpays.com/v1/create";

const FRONTEND_URL =
  "https://inmeenax.github.io/wallet/";

const CALLBACK_URL =
  "https://watchpays-api1.moxoga3282.workers.dev/callback";

const ALLOWED_ORIGIN =
  "https://inmeenax.github.io";


export default {

  async fetch(request, env) {

    const url =
      new URL(request.url);

    const path =
      url.pathname;


    /* -----------------------------
       CORS
    ----------------------------- */

    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods":
        "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type",
      "Cache-Control": "no-store"
    };


    if (request.method === "OPTIONS") {

      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }


    try {

      /*
       * CREATE PAYMENT
       */
      if (
        path === "/create-payment" &&
        request.method === "POST"
      ) {

        return await createPayment(
          request,
          env,
          corsHeaders
        );
      }


      /*
       * WATCHPAYS CALLBACK
       */
      if (
        path === "/callback" &&
        request.method === "POST"
      ) {

        return await handleCallback(
          request,
          env
        );
      }


      /*
       * TRANSACTION LIST
       */
      if (
        path === "/transactions" &&
        request.method === "GET"
      ) {

        return await getTransactions(
          env,
          corsHeaders
        );
      }


      /*
       * HEALTH CHECK
       */
      if (
        path === "/" &&
        request.method === "GET"
      ) {

        return json(
          {
            success: true,
            service: "watchpays-api1",
            status: "online"
          },
          200,
          corsHeaders
        );
      }


      return json(
        {
          success: false,
          error: "Not found"
        },
        404,
        corsHeaders
      );


    } catch (error) {

      console.error(
        "Worker error:",
        error
      );

      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Internal server error"
        },
        500,
        corsHeaders
      );
    }
  }
};


/* =================================
   CREATE PAYMENT
================================= */

async function createPayment(
  request,
  env,
  corsHeaders
) {

  if (!env.PAYMENTS_KV) {

    return json(
      {
        success: false,
        error:
          "PAYMENTS_KV binding is missing."
      },
      500,
      corsHeaders
    );
  }


  if (
    !env.MERCHANT_ID ||
    !env.WATCHPAYS_API_KEY
  ) {

    return json(
      {
        success: false,
        error:
          "WatchPays environment variables are missing."
      },
      500,
      corsHeaders
    );
  }


  let body;

  try {

    body =
      await request.json();

  } catch {

    return json(
      {
        success: false,
        error: "Invalid JSON body."
      },
      400,
      corsHeaders
    );
  }


  const amountNumber =
    Number(body.amount);


  /*
   * Amount validation.
   *
   * The frontend can create custom
   * amounts. This range can be
   * changed if WatchPays has a
   * different merchant limit.
   */

  if (
    !Number.isFinite(amountNumber) ||
    amountNumber < 1 ||
    amountNumber > 100000
  ) {

    return json(
      {
        success: false,
        error:
          "Invalid amount. Amount must be between 1 and 100000."
      },
      400,
      corsHeaders
    );
  }


  const amount =
    amountNumber.toFixed(2);


  /*
   * Our unique order number.
   */

  const merchantOrderNo =
    "ORD_" +
    Date.now() +
    "_" +
    crypto.randomUUID()
      .replaceAll("-", "")
      .slice(0, 10);


  /*
   * Save PENDING record BEFORE
   * calling WatchPays.
   *
   * This gives us an internal
   * record for this payment.
   */

  const pendingRecord = {

    merchantOrderNo,

    watchpaysOrderNo: null,

    amount,

    status: "PENDING",

    createdAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString(),

    successAt: null,

    processed: false,

    source: "wallet"

  };


  await env.PAYMENTS_KV.put(
    `payment:${merchantOrderNo}`,
    JSON.stringify(pendingRecord)
  );


  /*
   * WatchPays signature parameters.
   *
   * REQUIRED ORDER:
   *
   * amount
   * callback_url
   * merchant_id
   * merchant_order_no
   */

  const params = {

    merchant_id:
      env.MERCHANT_ID,

    amount,

    merchant_order_no:
      merchantOrderNo,

    callback_url:
      CALLBACK_URL

  };


  const sortedKeys =
    Object.keys(params).sort();


  let signString = "";


  for (const key of sortedKeys) {

    const value =
      params[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {

      signString +=
        `${key}=${value}&`;
    }
  }


  signString +=
    `key=${env.WATCHPAYS_API_KEY}`;


  const signature =
    await md5(signString);


  /*
   * WatchPays request.
   */

  const watchPaysPayload = {

    merchant_id:
      env.MERCHANT_ID,

    api_key:
      env.WATCHPAYS_API_KEY,

    amount,

    merchant_order_no:
      merchantOrderNo,

    callback_url:
      CALLBACK_URL,

    signature

  };


  let watchPaysResponse;


  try {

    watchPaysResponse =
      await fetch(
        WATCHPAYS_CREATE_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              watchPaysPayload
            )
        }
      );

  } catch (error) {

    await markPaymentFailed(
      env,
      merchantOrderNo,
      error instanceof Error
        ? error.message
        : "WatchPays connection failed"
    );

    return json(
      {
        success: false,
        error:
          "Could not connect to WatchPays."
      },
      502,
      corsHeaders
    );
  }


  let data;


  try {

    data =
      await watchPaysResponse.json();

  } catch {

    await markPaymentFailed(
      env,
      merchantOrderNo,
      "Invalid WatchPays response"
    );

    return json(
      {
        success: false,
        error:
          "WatchPays returned an invalid response."
      },
      502,
      corsHeaders
    );
  }


  /*
   * WatchPays rejected order.
   */

  if (
    !watchPaysResponse.ok ||
    !data.success ||
    !data.payment_url
  ) {

    await markPaymentFailed(
      env,
      merchantOrderNo,
      data.error ||
      data.message ||
      "WatchPays rejected the payment."
    );


    return json(
      {
        success: false,

        error:
          data.error ||
          data.message ||
          "WatchPays payment creation failed.",

        merchant_order_no:
          merchantOrderNo
      },
      400,
      corsHeaders
    );
  }


  /*
   * WatchPays success.
   *
   * Save gateway order number.
   */

  const watchpaysOrderNo =
    data.order_no || null;


  const updatedRecord = {

    ...pendingRecord,

    watchpaysOrderNo,

    status: "PENDING",

    updatedAt:
      new Date().toISOString(),

    watchpaysStatus:
      data.status || "created",

    paymentUrl:
      data.payment_url

  };


  await env.PAYMENTS_KV.put(
    `payment:${merchantOrderNo}`,
    JSON.stringify(updatedRecord)
  );


  /*
   * Return only what frontend
   * needs.
   *
   * API key is NEVER returned.
   */

  return json(
    {
      success: true,

      merchant_order_no:
        merchantOrderNo,

      order_no:
        watchpaysOrderNo,

      amount,

      payment_url:
        data.payment_url,

      status:
        data.status || "created"

    },
    200,
    corsHeaders
  );
}


/* =================================
   WATCHPAYS CALLBACK
================================= */

async function handleCallback(
  request,
  env
) {

  if (!env.PAYMENTS_KV) {

    return new Response(
      "storage_error",
      {
        status: 500
      }
    );
  }


  let body;


  try {

    body =
      await request.json();

  } catch {

    return new Response(
      "invalid_json",
      {
        status: 400
      }
    );
  }


  /*
   * WatchPays callback:
   *
   * {
   *   orderNo: "...",
   *   merchantOrder: "...",
   *   status: "success",
   *   amount: 1000
   * }
   */


  const merchantOrder =
    String(
      body.merchantOrder || ""
    ).trim();


  const gatewayOrder =
    String(
      body.orderNo || ""
    ).trim();


  const callbackStatus =
    String(
      body.status || ""
    ).trim()
      .toLowerCase();


  const callbackAmount =
    Number(body.amount);


  if (
    !merchantOrder ||
    !gatewayOrder ||
    !Number.isFinite(callbackAmount)
  ) {

    return new Response(
      "invalid_callback",
      {
        status: 400
      }
    );
  }


  /*
   * Find our original order.
   */

  const key =
    `payment:${merchantOrder}`;


  const existing =
    await env.PAYMENTS_KV.get(
      key,
      "json"
    );


  if (!existing) {

    return new Response(
      "order_not_found",
      {
        status: 404
      }
    );
  }


  /*
   * Verify amount exactly.
   */

  const originalAmount =
    Number(existing.amount);


  if (
    !Number.isFinite(originalAmount) ||
    originalAmount !== callbackAmount
  ) {

    console.error(
      "Amount mismatch:",
      {
        merchantOrder,
        originalAmount,
        callbackAmount
      }
    );


    return new Response(
      "amount_mismatch",
      {
        status: 400
      }
    );
  }


  /*
   * Verify WatchPays gateway order.
   */

  if (
    existing.watchpaysOrderNo &&
    String(
      existing.watchpaysOrderNo
    ) !== gatewayOrder
  ) {

    console.error(
      "Gateway order mismatch:",
      {
        merchantOrder,
        saved:
          existing.watchpaysOrderNo,
        callback:
          gatewayOrder
      }
    );


    return new Response(
      "order_mismatch",
      {
        status: 400
      }
    );
  }


  /*
   * Ignore duplicate success.
   */

  if (
    existing.status === "SUCCESS" &&
    existing.processed === true
  ) {

    return new Response(
      "success",
      {
        status: 200
      }
    );
  }


  /*
   * WatchPays documentation says
   * successful callback should be
   * marked successful.
   *
   * Non-success callback remains
   * pending unless it explicitly
   * says failed.
   */

  if (
    callbackStatus !== "success"
  ) {

    const pendingUpdate = {

      ...existing,

      watchpaysOrderNo:
        gatewayOrder,

      status:
        callbackStatus === "failed"
          ? "FAILED"
          : "PENDING",

      updatedAt:
        new Date().toISOString()

    };


    await env.PAYMENTS_KV.put(
      key,
      JSON.stringify(
        pendingUpdate
      )
    );


    return new Response(
      "success",
      {
        status: 200
      }
    );
  }


  /*
   * SUCCESS
   *
   * This is the point at which
   * the amount becomes part of
   * the successful wallet total.
   */

  const successRecord = {

    ...existing,

    merchantOrderNo:
      merchantOrder,

    watchpaysOrderNo:
      gatewayOrder,

    amount:
      Number(originalAmount)
        .toFixed(2),

    status:
      "SUCCESS",

    processed:
      true,

    successAt:
      new Date().toISOString(),

    updatedAt:
      new Date().toISOString()

  };


  await env.PAYMENTS_KV.put(
    key,
    JSON.stringify(
      successRecord
    )
  );


  /*
   * WatchPays expects "success".
   */

  return new Response(
    "success",
    {
      status: 200
    }
  );
}


/* =================================
   TRANSACTIONS API
================================= */

async function getTransactions(
  env,
  corsHeaders
) {

  if (!env.PAYMENTS_KV) {

    return json(
      {
        success: false,
        error:
          "PAYMENTS_KV binding is missing."
      },
      500,
      corsHeaders
    );
  }


  const transactions = [];

  let cursor;


  /*
   * KV list supports prefix and
   * pagination.
   */

  do {

    const result =
      await env.PAYMENTS_KV.list({
        prefix: "payment:",
        limit: 1000,
        ...(cursor
          ? { cursor }
          : {})
      });


    const keys =
      result.keys || [];


    /*
     * KV get supports up to 100
     * keys in one multi-get.
     */

    for (
      let i = 0;
      i < keys.length;
      i += 100
    ) {

      const batch =
        keys.slice(
          i,
          i + 100
        );


      const values =
        await env.PAYMENTS_KV.get(
          batch.map(
            key => key.name
          ),
          "json"
        );


      for (const key of batch) {

        const value =
          values.get(key.name);


        if (value) {
          transactions.push(value);
        }
      }
    }


    cursor =
      result.list_complete
        ? undefined
        : result.cursor;

  } while (cursor);


  /*
   * Newest first.
   */

  transactions.sort(
    (a, b) => {

      const aTime =
        new Date(
          a.createdAt || 0
        ).getTime();

      const bTime =
        new Date(
          b.createdAt || 0
        ).getTime();

      return bTime - aTime;
    }
  );


  /*
   * Keep response reasonably
   * sized for the dashboard.
   */

  const visibleTransactions =
    transactions.slice(0, 200);


  let balance = 0;


  for (
    const transaction
    of visibleTransactions
  ) {

    if (
      transaction.status === "SUCCESS"
    ) {

      balance +=
        Number(transaction.amount) || 0;
    }
  }


  return json(
    {
      success: true,

      totalBalance:
        balance.toFixed(2),

      transactions:
        visibleTransactions

    },
    200,
    corsHeaders
  );
}


/* =================================
   FAILED PAYMENT
================================= */

async function markPaymentFailed(
  env,
  merchantOrderNo,
  reason
) {

  const key =
    `payment:${merchantOrderNo}`;


  const existing =
    await env.PAYMENTS_KV.get(
      key,
      "json"
    );


  if (!existing) {
    return;
  }


  const updated = {

    ...existing,

    status:
      "FAILED",

    error:
      reason,

    updatedAt:
      new Date().toISOString()

  };


  await env.PAYMENTS_KV.put(
    key,
    JSON.stringify(updated)
  );
}


/* =================================
   JSON RESPONSE
================================= */

function json(
  data,
  status = 200,
  extraHeaders = {}
) {

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",

        ...extraHeaders
      }
    }
  );
}


/* =================================
   MD5
================================= */

async function md5(
  text
) {

  const data =
    new TextEncoder().encode(text);


  const hashBuffer =
    await crypto.subtle.digest(
      "MD5",
      data
    );


  const hashArray =
    Array.from(
      new Uint8Array(hashBuffer)
    );


  return hashArray
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}
