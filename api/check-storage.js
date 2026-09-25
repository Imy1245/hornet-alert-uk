export default async function handler(req, res) {
  const checkedAt = new Date().toISOString();

  /*
   * Vercel's Upstash integration commonly provides
   * KV_REST_API_URL and KV_REST_API_TOKEN.
   *
   * We also support Upstash's standard variable names
   * just in case Vercel uses those instead.
   */
  const redisUrl =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;

  const redisToken =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return res.status(500).json({
      ok: false,
      service: "Hornet Alert UK",
      checkedAt,
      message: "Redis environment variables were not found.",
      environmentCheck: {
        KV_REST_API_URL: Boolean(
          process.env.KV_REST_API_URL
        ),
        KV_REST_API_TOKEN: Boolean(
          process.env.KV_REST_API_TOKEN
        ),
        UPSTASH_REDIS_REST_URL: Boolean(
          process.env.UPSTASH_REDIS_REST_URL
        ),
        UPSTASH_REDIS_REST_TOKEN: Boolean(
          process.env.UPSTASH_REDIS_REST_TOKEN
        )
      }
    });
  }

  const redisCommand = async (...command) => {
    const response = await fetch(redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command)
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data.error ||
        `Redis returned HTTP ${response.status}`
      );
    }

    return data.result;
  };

  try {
    /*
     * Create a temporary test value.
     * It automatically expires after 60 seconds.
     */
    const testKey =
      "hornet-alert:storage-connection-test";

    const testValue =
      `connected-${checkedAt}`;

    const writeResult = await redisCommand(
      "SET",
      testKey,
      testValue,
      "EX",
      60
    );

    /*
     * Read the exact same value back.
     */
    const storedValue = await redisCommand(
      "GET",
      testKey
    );

    const matches =
      storedValue === testValue;

    /*
     * Clean up the temporary test record.
     */
    await redisCommand(
      "DEL",
      testKey
    );

    if (!matches) {
      return res.status(500).json({
        ok: false,
        service: "Hornet Alert UK",
        checkedAt,
        message:
          "Redis accepted the write but the read-back value did not match."
      });
    }

    return res.status(200).json({
      ok: true,
      service: "Hornet Alert UK",
      checkedAt,
      storage: {
        connected: true,
        writeSuccessful:
          writeResult === "OK",
        readSuccessful: true,
        cleanedUp: true
      },
      message:
        "Hornet Alert UK can successfully write to and read from persistent storage."
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      service: "Hornet Alert UK",
      checkedAt,
      storage: {
        connected: false
      },
      error: error.message
    });
  }
}
