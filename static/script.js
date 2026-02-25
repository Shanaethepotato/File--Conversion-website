
document.addEventListener("DOMContentLoaded", function () {

    // --- Elements ---
    const fileInput   = document.getElementById("fileInput");
    const dropzone    = document.getElementById("dropzone");
    const fileBadge   = document.getElementById("fileBadge");
    const fileNameText = document.getElementById("fileNameText");
    const removeFile  = document.getElementById("removeFile");
    const formatRadios = document.querySelectorAll('input[name="format"]');
    const convertBtn  = document.getElementById("convertBtn");
    const errorMsg    = document.getElementById("errorMsg");

   
    let selectedFile   = null;
    let selectedFormat = null;


    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.hidden = false;
    }

    function clearError() {
        errorMsg.textContent = "";
        errorMsg.hidden = true;
    }

    function setFile(file) {
        selectedFile = file;
        fileNameText.textContent = file.name;
        fileBadge.hidden = false;
        dropzone.style.display = "none";
        clearError();
        updateButton();
    }

    function clearFile() {
        selectedFile = null;
        fileInput.value = "";
        fileBadge.hidden = true;
        dropzone.style.display = "";
        updateButton();
    }

    function updateButton() {
        convertBtn.disabled = !(selectedFile && selectedFormat);
    }

    function setLoading(on) {
        convertBtn.classList.toggle("loading", on);
        convertBtn.disabled = on;
    }

    
    fileInput.addEventListener("change", function () {
        if (fileInput.files.length > 0) {
            setFile(fileInput.files[0]);
        }
    });

    // -------------------------------------------------------
    // Drag-and-drop
    // -------------------------------------------------------
    dropzone.addEventListener("dragover", function (e) {
        e.preventDefault();
        dropzone.classList.add("drag-over");
    });

    dropzone.addEventListener("dragleave", function () {
        dropzone.classList.remove("drag-over");
    });

    dropzone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file) setFile(file);
    });

    // -------------------------------------------------------
    // Remove selected file
    // -------------------------------------------------------
    removeFile.addEventListener("click", function (e) {
        e.preventDefault();
        clearFile();
    });

    // -------------------------------------------------------
    // Format selection
    // -------------------------------------------------------
    formatRadios.forEach(function (radio) {
        radio.addEventListener("change", function () {
            selectedFormat = radio.value;
            clearError();
            updateButton();
        });
    });

    // -------------------------------------------------------
    // Convert
    // -------------------------------------------------------
    convertBtn.addEventListener("click", function () {
        clearError();

        if (!selectedFile) {
            showError("Please select a file first.");
            return;
        }
        if (!selectedFormat) {
            showError("Please choose an output format.");
            return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("format", selectedFormat);

        setLoading(true);

        console.log("Sending request to /convert...");
        console.log("File:", selectedFile.name, selectedFile.type, selectedFile.size, "bytes");
        console.log("Format:", selectedFormat);

        fetch("/convert", {
            method: "POST",
            body: formData
        })
        .then(function(r) {
            console.log("Response status:", r.status, r.statusText);
            console.log("Response headers:", [...r.headers.entries()]);
            return r;
        })
        .then(function (response) {
            if (!response.ok) {
                // Safely try to parse JSON error, fall back to status text
                return response.text().then(function (text) {
                    let msg = "Conversion failed.";
                    if (text) {
                        try {
                            const data = JSON.parse(text);
                            msg = data.error || msg;
                        } catch (_) {
                            msg = text;
                        }
                    }
                    throw new Error(msg);
                });
            }
            return response.blob();
        })
        .then(function (blob) {
            // Trigger browser download
            const url = URL.createObjectURL(blob);
            const a   = document.createElement("a");
            a.href     = url;
            a.download = "converted." + selectedFormat;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        })
        .catch(function (err) {
            showError(err.message || "An unexpected error occurred.");
        })
        .finally(function () {
            setLoading(false);
            updateButton();
        });
    });

});
