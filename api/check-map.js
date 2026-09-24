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

        return {
          id: index + 1,
          location: decode(name),
          description: decode(description),
          latitude: Number(coordinates[2]),
          longitude: Number(coordinates[1])
        };
      })
      .filter(Boolean);

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
      records: records.slice(0, 20)
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
