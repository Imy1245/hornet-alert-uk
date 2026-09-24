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

    const placemarks =
      kml.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];

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

    const records = placemarks
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

        const cleanName = decode(name);
        const cleanDescription = decode(description);

        const searchable =
          `${cleanName} ${cleanDescription}`.toLowerCase();

        let type = "record";

        if (
          searchable.includes("nest") ||
          searchable.includes("destroyed")
        ) {
          type = "nest";
        } else if (
          searchable.includes("confirmed sighting") ||
          searchable.includes("confirmed")
        ) {
          type = "confirmed-sighting";
        } else if (
          searchable.includes("sighting") ||
          searchable.includes("sighted") ||
          searchable.includes("spotted")
        ) {
          type = "sighting";
        }

        const is2026 =
          /\b2026\b/i.test(cleanDescription) ||
          /\b2026\b/i.test(cleanName);

        return {
          id: index + 1,
          location: cleanName,
          description: cleanDescription,
          latitude: Number(coordinates[2]),
          longitude: Number(coordinates[1]),
          type,
          year: is2026 ? 2026 : null
        };
      })
      .filter(Boolean);

    const records2026 = records.filter(
      record => record.year === 2026
    );

    const summary2026 = {
      total: records2026.length,
      nests: records2026.filter(
        record => record.type === "nest"
      ).length,
      confirmedSightings: records2026.filter(
        record => record.type === "confirmed-sighting"
      ).length,
      sightings: records2026.filter(
        record => record.type === "sighting"
      ).length,
      other: records2026.filter(
        record => record.type === "record"
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
      placemarksFound: placemarks.length,
      recordsWithCoordinates: records.length,
      summary2026,
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
