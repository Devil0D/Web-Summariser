from flask import Flask, request, jsonify
import pypdf
import io

# Import your actual summarization functions
from bart import bart_summary
from T5 import t5_summary
from extractive_summary import extractive_summary

app = Flask(__name__)

@app.route('/summarize', methods=['POST'])
def summarize_text():
    try:
        # Get the text prompt from the form data (if it exists)
        prompt_text = request.form.get('text', '')
        
        # Get the file from the form data (if it exists)
        file = request.files.get('file')
        
        text_to_summarize = ""

        if file and file.filename != '':
            if file.mimetype == 'application/pdf':
                # If there's a PDF, extract its text
                pdf_reader = pypdf.PdfReader(io.BytesIO(file.read()))
                for page in pdf_reader.pages:
                    text_to_summarize += page.extract_text()
            else:
                return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400
        else:
            # If no file, use the text prompt
            text_to_summarize = prompt_text

        if not text_to_summarize:
            return jsonify({'error': 'No text or file provided to summarize.'}), 400

        # --- Your summarization logic remains the same ---
        bart_out = bart_summary(text_to_summarize)
        t5_out = t5_summary(text_to_summarize)
        lex_out = extractive_summary(text_to_summarize)

        combined_text = f"{bart_out} {t5_out} {lex_out}"
        golden_summary = extractive_summary(combined_text)

        return jsonify({
            'bart_summary': bart_out,
            't5_summary': t5_out,
            'extractive_summary': lex_out,
            'final_summary': golden_summary
        })

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({'error': 'Failed to process the request.'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)