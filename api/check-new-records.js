export default async function handler(req, res) {
  const checkedAt = new Date().toISOString();
  const targetYear = new Date().getUTCFullYear();

  const mapId = "1BGAdYHaIszxPKWrjX8dASHpU8mN-_2HV";

  const kmlUrl =
    `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=true`;

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
      error:
        "Redis environment variables were not found."
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

  const decode = (text = "") =>
    text
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const classifyRecord = description => {
    const text =
      description.toLowerCase();

    if (
      text.includes("confirmed primary nest") ||
      text.includes("confirmed secondary nest") ||
      text.includes("confirmed nest")
    ) {
      return {
        type: "nest",
        status: "confirmed"
      };
    }

    if (
      text.includes("embryo nest") ||
      text.includes("primary nest") ||
      text.includes("secondary nest") ||
      /^nest\b/i.test(description.trim())
    ) {
      return {
        type: "nest",
        status: "reported"
      };
    }

    if (
      text.includes("confirmed sighting")
    ) {
      return {
        type: "sighting",
        status: "confirmed"
      };
    }

    if (
      text.includes("credible sighting")
    ) {
      return {
        type: "sighting",
        status: "credible"
      };
    }

    if (
      text.includes("sighting") ||
      text.includes("sightings")
    ) {
      return {
        type: "sighting",
        status: "reported"
      };
    }

    if (
      text.includes("hornet") ||
      text.includes("hornets")
    ) {
      return {
        type: "hornet-record",
        status: "unclassified"
      };
    }

    return {
      type: "other",
      status: "unclassified"
    };
  };

  const extractDate = description => {
    const months = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12
    };

    const numeric =
      description.match(
        /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/
      );

    if (numeric) {
      const day =
        Number(numeric[1]);

      const month =
        Number(numeric[2]);

      let year =
        Number(numeric[3]);

      if (year < 100) {
        year += 2000;
      }

      if (
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12
      ) {
        return `${year}-${String(month).padStart(
          2,
          "0"
        )}-${String(day).padStart(
          2,
          "0"
        )}`;
      }
    }

    const written =
      description.match(
        /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i
      );

    if (written) {
      const day =
        Number(written[1]);

      const month =
        months[
          written[2].toLowerCase()
        ];

      if (
        day >= 1 &&
        day <= 31
      ) {
        return `${targetYear}-${String(
          month
        ).padStart(
          2,
          "0"
        )}-${String(
          day
        ).padStart(
          2,
          "0"
        )}`;
      }
    }

    return null;
  };

  try {
    const mapResponse =
      await fetch(kmlUrl, {
        headers: {
          "User-Agent":
            "Hornet Alert UK/1.0"
        }
      });

    if (!mapResponse.ok) {
      throw new Error(
        `Map returned HTTP ${mapResponse.status}`
      );
    }

    const kml =
      await mapResponse.text();

    const folders =
      kml.match(
        /<Folder[\s\S]*?<\/Folder>/gi
      ) || [];

    const currentYearFolder =
      folders.find(folder => {
        const name =
          folder.match(
            /<name>([\s\S]*?)<\/name>/i
          )?.[1] || "";

        return (
          decode(name) ===
          String(targetYear)
        );
      });

    if (!currentYearFolder) {
      throw new Error(
        `${targetYear} map layer not found`
      );
    }

    const placemarks =
      currentYearFolder.match(
        /<Placemark[\s\S]*?<\/Placemark>/gi
      ) || [];

    const records =
      placemarks
        .map(placemark => {
          const name =
            placemark.match(
              /<name>([\s\S]*?)<\/name>/i
            )?.[1] || "";

          const description =
            placemark.match(
              /<description>([\s\S]*?)<\/description>/i
            )?.[1] || "";

          const coordinates =
            placemark.match(
              /<coordinates>\s*([-\d.]+),([-\d.]+)(?:,[-\d.]+)?\s*<\/coordinates>/i
            );

          if (!coordinates) {
            return null;
          }

          const cleanLocation =
            decode(name);

          const cleanDescription =
            decode(description);

          const latitude =
            Number(coordinates[2]);

          const longitude =
            Number(coordinates[1]);

          const classification =
            classifyRecord(
              cleanDescription
            );

          const eventDate =
            extractDate(
              cleanDescription
            );

          /*
           * Stable record ID.
           *
           * Reordering markers on the
           * Google map will not make an
           * existing marker appear new.
           */
          const fingerprint = [
            String(targetYear),
            cleanLocation.toLowerCase(),
            cleanDescription.toLowerCase(),
            latitude.toFixed(5),
            longitude.toFixed(5)
          ].join("|");

          return {
            id: fingerprint,
            year: targetYear,
            eventDate,
            location: cleanLocation,
            description:
              cleanDescription,
            type:
              classification.type,
            status:
              classification.status,
            latitude,
            longitude
          };
        })
        .filter(Boolean);

    /*
     * Redis storage keys.
     *
     * Each year gets its own baseline
     * and its own list of seen records.
     */
    const keyPrefix =
      `hornet-alert:map:${targetYear}`;

    const seenKey =
      `${keyPrefix}:seen-records`;

    const initializedKey =
      `${keyPrefix}:initialized-at`;

    const lastCheckedKey =
      `${keyPrefix}:last-checked-at`;

    const lastNewRecordsKey =
      `${keyPrefix}:last-new-records`;

    const initializedAt =
      await redisCommand(
        "GET",
        initializedKey
      );

    const currentIds =
      records.map(
        record => record.id
      );

    /*
     * FIRST RUN
     *
     * Save everything already on the
     * map as the starting baseline.
     *
     * This prevents the app from
     * announcing every existing marker
     * as a new alert.
     */
    if (!initializedAt) {
      if (
        currentIds.length > 0
      ) {
        await redisCommand(
          "SADD",
          seenKey,
          ...currentIds
        );
      }

      await redisCommand(
        "SET",
        initializedKey,
        checkedAt
      );

      await redisCommand(
        "SET",
        lastCheckedKey,
        checkedAt
      );

      await redisCommand(
        "SET",
        lastNewRecordsKey,
        JSON.stringify([])
      );

      return res
        .status(200)
        .json({
          ok: true,
          service:
            "Hornet Alert UK",
          checkedAt,

          mode:
            "baseline",

          baselineCreated:
            true,

          year:
            targetYear,

          recordsChecked:
            records.length,

          newRecordsFound:
            0,

          newRecords:
            [],

          notice:
            "Initial baseline created. Existing map records were saved without generating new-record alerts."
        });
    }

    /*
     * NORMAL MONITORING
     *
     * Load all previously seen IDs.
     */
    const storedIds =
      await redisCommand(
        "SMEMBERS",
        seenKey
      ) || [];

    const seen =
      new Set(storedIds);

    /*
     * Anything not already in Redis
     * is new since the previous checks.
     */
    const newRecords =
      records.filter(
        record =>
          !seen.has(record.id)
      );

    /*
     * Save new records so they do not
     * trigger again next time.
     */
    if (
      newRecords.length > 0
    ) {
      await redisCommand(
        "SADD",
        seenKey,
        ...newRecords.map(
          record => record.id
        )
      );
    }

    await redisCommand(
      "SET",
      lastCheckedKey,
      checkedAt
    );

    await redisCommand(
      "SET",
      lastNewRecordsKey,
      JSON.stringify(
        newRecords
      )
    );

    return res
      .status(200)
      .json({
        ok: true,

        service:
          "Hornet Alert UK",

        checkedAt,

        mode:
          "monitoring",

        baselineCreated:
          false,

        year:
          targetYear,

        initializedAt,

        recordsChecked:
          records.length,

        previouslySeen:
          storedIds.length,

        newRecordsFound:
          newRecords.length,

        newRecords,

        notice:
          "New means newly added to the monitored map since the stored baseline. It does not automatically mean officially confirmed."
      });

  } catch (error) {
    return res
      .status(500)
      .json({
        ok: false,

        service:
          "Hornet Alert UK",

        checkedAt,

        error:
          error.message
      });
  }
}
