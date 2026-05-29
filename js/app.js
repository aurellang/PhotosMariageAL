const photosInput = document.getElementById("photos");
const selectBtn = document.getElementById("selectBtn");
const uploadBtn = document.getElementById("uploadBtn");
const fileInfo = document.getElementById("fileInfo");
const progress = document.getElementById("progress");
const message = document.getElementById("message");

selectBtn.addEventListener("click", () => {
  photosInput.click();
});

photosInput.addEventListener("change", () => {
  const count = photosInput.files.length;
  uploadBtn.disabled = count === 0;
  fileInfo.textContent = count
    ? `${count} photo(s) sélectionnée(s).`
    : "Aucune photo sélectionnée.";
});

uploadBtn.addEventListener("click", async () => {
  const files = Array.from(photosInput.files);

  if (!files.length) {
    message.textContent = "Sélectionne au moins une photo.";
    return;
  }

  progress.value = 0;
  message.textContent = "Upload en cours...";

  let uploaded = 0;

  try {
    for (const file of files) {
      await uploadFileWithFallback(file, (fileProgress) => {
        const globalProgress = ((uploaded + fileProgress / 100) / files.length) * 100;
        progress.value = Math.round(globalProgress);
      });

      uploaded++;
      progress.value = Math.round((uploaded / files.length) * 100);
    }

    message.textContent = "Upload terminé ✅";
    photosInput.value = "";
    uploadBtn.disabled = true;
    fileInfo.textContent = "Aucune photo sélectionnée.";
  } catch (error) {
    console.error(error);
    message.textContent = `Erreur : ${error.message}`;
  }
});

async function uploadFileWithFallback(file, onProgress) {
  const base64 = await fileToBase64(file);

  const payload = {
    name: file.name,
    type: file.type,
    size: file.size,
    data: base64.split(",")[1]
  };

  let lastError = null;

  for (const endpoint of DRIVE_ENDPOINTS) {
    try {
      message.textContent = `Upload vers ${endpoint.name}...`;

      const result = await postJsonWithProgress(endpoint.url, payload, onProgress);

      if (result.success) {
        return result;
      }

      if (result.code === "DRIVE_FULL") {
        lastError = new Error(`${endpoint.name} est plein.`);
        continue;
      }

      throw new Error(result.message || `Erreur sur ${endpoint.name}`);
    } catch (error) {
      lastError = error;
      console.warn(`Échec sur ${endpoint.name}`, error);
    }
  }

  throw lastError || new Error("Tous les comptes Drive ont échoué.");
}

async function postJsonWithProgress(url, payload, onProgress) {
  onProgress(20);

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  onProgress(90);

  const text = await response.text();
  console.log("Réponse Apps Script :", text);

  const json = JSON.parse(text);

  onProgress(100);
  return json;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Lecture impossible : ${file.name}`));

    reader.readAsDataURL(file);
  });
}