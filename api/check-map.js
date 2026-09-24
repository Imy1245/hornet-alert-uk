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

    // Find every style definition and its icon image
    const styleBlocks =
      kml.match(/<Style\b[\s\S]*?<\/Style>/gi) || [];

    const styles = styleBlocks
      .map(style => {
        const id =
          style.match(/<Style[^>]*id=["']([^"']+)["']/i)?.[1] || "";

        const iconHref =
          style.match(/<href>([\s\S]*?)<\/href>/i)?.[1] || "";

        return {
          id,
          iconHref: decode(iconHref)
        };
      })
      .filter(style => style.id);

    // Find the 2026 folder
    const folders =
      kml.match(/<Folder[\s\S]*?<\/Folder>/gi) || [];

    const folder2026 = folders.find(folder => {
      const name =
        folder.match(/<name>([\s\S]*?)<\/name>/i)?.[1] || "";

      return decode(name) === "2026";
    });

    const records2026 = [];

    if (folder2026) {
      const placemarks =
        folder2026.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];

      placemarks.forEach((placemark, index) => {
        const name =
          placemark.match(/<name>([\s\S]*?)<\/name>/i)?.[1] || "";

        const description =
          placemark.match(
            /<description>([\s\S]*?)<\/description>/i
          )?.[1] || "";

        const styleUrl =
          placemark.match(
            /<styleUrl>([\s\S]*?)<\/styleUrl>/i
          )?.[1] || "";

        const coordinates =
          placemark.match(
            /<coordinates>\s*([-\d.]+),([-\d.]+)(?:,[-\d.]+)?\s*<\/coordinates>/i
          );

        if (!coordinates) return;

        const cleanStyleUrl = decode(styleUrl);
        const styleId = cleanStyleUrl.replace(/^#/, "");

        const matchingStyle =
          styles.find(style => style.id === styleId) || null;

        records2026.push({
          id: index + 1,
          location: decode(name),
          description: decode(description),
          styleUrl: cleanStyleUrl,
          iconHref: matchingStyle?.iconHref || null,
          latitude: Number(coordinates[2]),
          longitude: Number(coordinates[1])
        });
      });
    }

    const styleUsage = {};

    records2026.forEach(record => {
      const key = record.styleUrl || "none";

      if (!styleUsage[key]) {
        styleUsage[key] = {
          styleUrl: key,
          iconHref: record.iconHref,
          count: 0,
          examples: []
        };
      }

      styleUsage[key].count++;

      if (styleUsage[key].examples.length < 3) {
        styleUsage[key].examples.push({
          location: record.location,
          description: record.description
        });
      }
    });

    return res.status(200).json({
      ok: true,
      service: "Hornet Alert UK",
      checkedAt,
      source: {
        name: "Asian Hornet Map UK",
        mapId,
        reachable: true
      },
      stylesFound: styles.length,
      records2026Found: records2026.length,
      styleUsage2026: Object.values(styleUsage),
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
