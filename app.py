from flask import Flask, render_template, request, send_file, jsonify, after_this_request
import os
import subprocess
from werkzeug.utils import secure_filename
import uuid

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

FFMPEG_PATH = r"C:\ffmpeg\bin\ffmpeg.exe"

ALLOWED_INPUT_FORMATS  = {"mp4", "mp3", "jpg", "jpeg", "png", "mov", "avi", "wav"}
ALLOWED_OUTPUT_FORMATS = {"mp4", "mp3", "jpg", "png"}


def get_extension(filename):
    """Safely extract the lowercase file extension."""
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[1].lower()


def cleanup_file(path):
    """Silently remove a file if it exists."""
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/convert", methods=["POST"])
def convert():
    input_path  = None
    output_path = None

    try:
        file = request.files.get("file")
        output_format = request.form.get("format", "").lower().strip()

        if not file or not file.filename:
            return jsonify({"error": "No file provided."}), 400

        input_ext = get_extension(file.filename)
        if not input_ext or input_ext not in ALLOWED_INPUT_FORMATS:
            return jsonify({"error": f"Unsupported input format: .{input_ext}"}), 400

        if output_format not in ALLOWED_OUTPUT_FORMATS:
            return jsonify({"error": f"Unsupported output format: .{output_format}"}), 400


        unique_id      = str(uuid.uuid4())
        input_filename = secure_filename(f"{unique_id}.{input_ext}")
        input_path     = os.path.join(app.config["UPLOAD_FOLDER"], input_filename)
        file.save(input_path)

        output_filename = f"{unique_id}_converted.{output_format}"
        output_path     = os.path.join(app.config["UPLOAD_FOLDER"], output_filename)

        result = subprocess.run(
            [FFMPEG_PATH, "-y", "-i", input_path, output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120
        )

        cleanup_file(input_path) 

        if result.returncode != 0:
            cleanup_file(output_path)
            ffmpeg_error = result.stderr.strip().splitlines()
            short_error = "\n".join(ffmpeg_error[-5:]) if ffmpeg_error else "Unknown FFmpeg error."
            return jsonify({"error": f"FFmpeg error: {short_error}"}), 500

        @after_this_request
        def remove_output(response):
            cleanup_file(output_path)
            return response

        return send_file(
            output_path,
            as_attachment=True,
            download_name=f"converted.{output_format}"
        )

    except subprocess.TimeoutExpired:
        cleanup_file(input_path)
        cleanup_file(output_path)
        return jsonify({"error": "Conversion timed out. Try a smaller file."}), 500

    except Exception as e:
        cleanup_file(input_path)
        cleanup_file(output_path)
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True)
