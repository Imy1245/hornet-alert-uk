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

    const classifyRecord = description => {
      const text = description.toLowerCase();

      if (
        text.includes("confirmed primary nest") ||
        text.includes("confirmed secondary nest")
      ) {
        return {
          type: "nest",
          status: "confirmed"
        };
      }

      if (
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
        text.includes("confirmed sighting") ||
        text.includes("credible sighting")
      ) {
        return {
          type: "sighting",
          status: "confirmed-or-credible"
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
        const classification = classifyRecord(cleanDescription);

        return {
          id: `2026-${index + 1}`,
          year: 2026,
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
        "Classification is derived from the map description. Original wording is preserved.",

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
