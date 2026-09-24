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

    const folderSummary = [];
    const allRecords = [];

    folders.forEach((folder, folderIndex) => {
      const folderNameRaw =
        folder.match(/<name>([\s\S]*?)<\/name>/i)?.[1] || "";

      const folderName = decode(folderNameRaw);

      const placemarks =
        folder.match(/<Placemark[\s\S]*?<\/Placemark>/gi) || [];

      folderSummary.push({
        folderNumber: folderIndex + 1,
        name: folderName,
        placemarks: placemarks.length
      });

      placemarks.forEach((placemark, placemarkIndex) => {
        const nameRaw =
          placemark.match(/<name>([\s\S]*?)<\/name>/i)?.[1] || "";

        const descriptionRaw =
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

        allRecords.push({
          id: `${folderIndex + 1}-${placemarkIndex + 1}`,
          layer: folderName,
          location: decode(nameRaw),
          description: decode(descriptionRaw),
          styleUrl: decode(styleUrl),
          latitude: Number(coordinates[2]),
          longitude: Number(coordinates[1])
        });
      });
    });

    const records2026 = allRecords.filter(record =>
      /\b2026\b/i.test(record.layer)
    );

    return res.status(200).json({
      ok: true,
      service: "Hornet Alert UK",
      checkedAt,
      source: {
        name: "Asian Hornet Map UK",
        mapId,
        reachable: true
      },
      foldersFound: folders.length,
      folderSummary,
      recordsFound: allRecords.length,
      records2026Found: records2026.length,
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
