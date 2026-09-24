export default async function handler(req, res) {
  const checkedAt = new Date().toISOString();

  const mapId = "1BGAdYHaIszxPKWrjX8dASHpU8mN-_2HV";
  const kmlUrl =
    `https://www.google.com/maps/d/kml?mid=${mapId}&forcekml=true`;

  try {
    const response = await fetch(kmlUrl, {
      headers: {
        "User-Agent": "Hornet Alert UK/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Map returned HTTP ${response.status}`);
    }

    const kml = await response.text();

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
      const text = description.toLowerCase();

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

      if (text.includes("confirmed sighting")) {
        return {
          type: "sighting",
          status: "confirmed"
        };
      }

      if (text.includes("credible sighting")) {
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

      // Formats such as 26.2.26, 29.5.26 or 13.6.26
      const numeric =
        description.match(
          /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/
        );

      if (numeric) {
        const day = Number(numeric[1]);
        const month = Number(numeric[2]);
        let year = Number(numeric[3]);

        if (year < 100) year += 2000;

        if (
          day >= 1 &&
          day <= 31 &&
          month >= 1 &&
          month <= 12
        ) {
          return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }

      // Formats such as 10th May, 30 April or 8 June
      const written =
        description.match(
          /\b(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i
        );

      if (written) {
        const day = Number(written[1]);
        const month = months[written[2].toLowerCase()];

        if (day >= 1 && day <= 31) {
          return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
      }

      return null;
    };

    const folders =
      kml.match(/<Folder[\s\S]*?<\/Folder>/gi) || [];

    const folder2026 = folders.find(folder => {
      const name =
        folder.match(/<name>([\s\S]*?)<\/name>/i)?.[1] || "";

      return decode(name) === "2026";
    });

    if (!folder2026) {
      throw new Error("2026 map layer not found");
    }

    const placemarks =
      folder2026.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];

    const records2026 = placemarks
      .map((placemark, index) => {
        const name =
          placemark.match(/<name>([\s\S]*?)<\/name>/i)?.[1] || "";

        const description =
          placemark.match(
            /<description>([\s\S]*?)<\/description>/i
          )?.[1] || "";

        const coordinates =
          placemark.match(
            /<coordinates>\s*([-\d.]+),([-\d.]+)(?:,[-\d.]+)?\s*<\/coordinates>/i
          );

        if (!coordinates) return null;

        const cleanDescription = decode(description);
        const classification =
          classifyRecord(cleanDescription);

        return {
          id: `2026-${index + 1}`,
          year: 2026,
          eventDate: extractDate(cleanDescription),
          location: decode(name),
          description: cleanDescription,
          type: classification.type,
          status: classification.status,
          latitude: Number(coordinates[2]),
          longitude: Number(coordinates[1])
        };
      })
      .filter(Boolean);

    const summary = {
      total: records2026.length,

      sightings: records2026.filter(
        record => record.type === "sighting"
      ).length,

      nests: records2026.filter(
        record => record.type === "nest"
      ).length,

      hornetRecords: records2026.filter(
        record => record.type === "hornet-record"
      ).length,

      unclassified: records2026.filter(
        record => record.status === "unclassified"
      ).length,

      datesExtracted: records2026.filter(
        record => record.eventDate
      ).length,

      datesMissing: records2026.filter(
        record => !record.eventDate
      ).length
    };

    return res.status(200).json({
      ok: true,
      service: "Hornet Alert UK",
      checkedAt,

      source: {
        name: "Asian Hornet Map UK",
        mapId,
        reachable: true
      },

      notice:
        "Classification and event dates are derived from the map wording. Original wording is preserved.",

      summary,
      records2026
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      service: "Hornet Alert UK",
      checkedAt,
      error: error.message
    });
  }
}
