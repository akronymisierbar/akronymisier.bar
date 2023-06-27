const convertToSeconds = (time: string) => {
  const [hours, minutes, seconds] = time.split(':').map(parseFloat);
  return hours * 3600 + minutes * 60 + seconds;
};

const generateJson = async (inputFile: string, outputFile: string) => {
  const data = await Deno.readTextFile(inputFile);
  const lines = data.split('\n').filter(line => line.trim() !== '');
  
  const chapters = lines.map(line => {
    const [startTime, ...titleParts] = line.split(' ');
    const title = titleParts.join(' ');
    return {
      startTime: convertToSeconds(startTime),
      title,
    };
  });

  const result = {
    version: "1.2.0",
    chapters,
  };

  await Deno.writeTextFile(outputFile, JSON.stringify(result, null, 2));
};

generateJson(Deno.args[0], Deno.args[1]);
