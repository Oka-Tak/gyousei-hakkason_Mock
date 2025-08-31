import pandas as pd
import google.generativeai as genai
import os
import json

# Configure Gemini API (replace with your actual API key or environment variable)
# It's recommended to set this as an environment variable: export GOOGLE_API_KEY='your_api_key'
genai.configure(api_key="AIzaSyCn9VuHWdwSCh6ilWaBoMbtarWkzj7qhCE")

def get_gemini_response(prompt_text):
    """
    Sends a prompt to the Gemini API and returns the parsed JSON response.
    """
    print(f"Sending prompt to Gemini API...")
    print(f"Prompt: {prompt_text}")
    
    model = genai.GenerativeModel('gemini-2.5-flash')
    try:
        response = model.generate_content(prompt_text)
        print(f"Raw Gemini response: {response.text}")
        
        # Extract JSON string from markdown code block if present
        response_text = response.text.strip()
        if response_text.startswith("```json") and response_text.endswith("```"):
            response_text = response_text[len("```json"): -len("```")].strip()
        
        print(f"Processed response text: {response_text}")
        
        parsed_response = json.loads(response_text)
        print(f"Successfully parsed JSON: {parsed_response}")
        return parsed_response
        
    except json.JSONDecodeError as e:
        print(f"JSON Decode Error from Gemini API: {e}")
        print(f"Raw Gemini response: {response.text}")
        return None
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        print(f"Prompt: {prompt_text}")
        return None

def generate_metadata_program(input_csv_path):
    """
    Generates genre, target, and region CSVs based on project data and Gemini API.
    """
    print(f"Reading input CSV: {input_csv_path}")
    df = pd.read_csv(input_csv_path)
    print(f"Successfully read {len(df)} rows from {input_csv_path}")

    all_genres = {}
    all_targets = {}
    all_regions = {}

    genre_id_counter = 1
    target_id_counter = 1
    region_id_counter = 1

    output_dir = "generated_data"
    os.makedirs(output_dir, exist_ok=True)
    print(f"Output directory: {output_dir}")

    # Open CSV files in append mode, write headers if files are new/empty
    genre_file = os.path.join(output_dir, "genre.csv")
    project_genre_file = os.path.join(output_dir, "project_genre.csv")
    target_file = os.path.join(output_dir, "target.csv")
    project_target_file = os.path.join(output_dir, "project_target.csv")
    region_file = os.path.join(output_dir, "region.csv")
    project_region_file = os.path.join(output_dir, "project_region.csv")

    def write_header_if_empty(filepath, header):
        if not os.path.exists(filepath) or os.stat(filepath).st_size == 0:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(header + '\n')

    write_header_if_empty(genre_file, "id,name")
    write_header_if_empty(project_genre_file, "project_id,genre_id")
    write_header_if_empty(target_file, "id,name")
    write_header_if_empty(project_target_file, "project_id,target_id")
    write_header_if_empty(region_file, "id,name")
    write_header_if_empty(project_region_file, "project_id,region_id")

    print("Starting to process each project entry...")
    for index, row in df.iterrows():
        project_id = row["予算事業ID"]
        purpose = row["事業の目的"]
        challenges = row["現状・課題"]
        print(f"\n=== Processing Project ID: {project_id} ===")
        print(f"Purpose: {purpose}")
        print(f"Challenges: {challenges}")

        combined_text = f"事業の目的: {purpose}\n現状・課題: {challenges}"
        prompt = f"""以下の事業の目的と現状・課題から、関連する「ジャンル (genres)」、「対象 (targets)」、「地域 (regions)」を抽出してください。
結果はJSON形式で出力し、他のテキストは一切含めないでください。
例: {{"genres": ["教育", "医療"], "targets": ["高齢者", "子供"], "regions": ["東京都", "全国"]}}

{combined_text}
"""
        
        max_retries = 3
        gemini_output = None
        for attempt in range(max_retries):
            print(f"Attempt {attempt + 1}/{max_retries} for Project ID: {project_id}")
            gemini_output = get_gemini_response(prompt)
            if gemini_output:
                print(f"Successfully received Gemini response for Project ID: {project_id}")
                break
            print(f"Retrying Gemini API call for Project ID: {project_id} (attempt {attempt + 1}/{max_retries})...")

        if gemini_output:
            print(f"Processing genres for Project ID: {project_id}")
            # Process Genres
            with open(genre_file, 'a', encoding='utf-8') as g_f, \
                 open(project_genre_file, 'a', encoding='utf-8') as pg_f:
                for genre_name in gemini_output.get("genres", []):
                    if genre_name not in all_genres:
                        all_genres[genre_name] = genre_id_counter
                        g_f.write(f"{genre_id_counter},{genre_name}\n")
                        genre_id_counter += 1
                        print(f"Added new genre: {genre_name} (ID: {all_genres[genre_name]})")
                    pg_f.write(f"{project_id},{all_genres[genre_name]}\n")
                    print(f"Linked project {project_id} to genre {genre_name}")

            print(f"Processing targets for Project ID: {project_id}")
            # Process Targets
            with open(target_file, 'a', encoding='utf-8') as t_f, \
                 open(project_target_file, 'a', encoding='utf-8') as pt_f:
                for target_name in gemini_output.get("targets", []):
                    if target_name not in all_targets:
                        all_targets[target_name] = target_id_counter
                        t_f.write(f"{target_id_counter},{target_name}\n")
                        target_id_counter += 1
                        print(f"Added new target: {target_name} (ID: {all_targets[target_name]})")
                    pt_f.write(f"{project_id},{all_targets[target_name]}\n")
                    print(f"Linked project {project_id} to target {target_name}")

            print(f"Processing regions for Project ID: {project_id}")
            # Process Regions
            with open(region_file, 'a', encoding='utf-8') as r_f, \
                 open(project_region_file, 'a', encoding='utf-8') as pr_f:
                for region_name in gemini_output.get("regions", []):
                    if region_name not in all_regions:
                        all_regions[region_name] = region_id_counter
                        r_f.write(f"{region_id_counter},{region_name}\n")
                        region_id_counter += 1
                        print(f"Added new region: {region_name} (ID: {all_regions[region_name]})")
                    pr_f.write(f"{project_id},{all_regions[region_name]}\n")
                    print(f"Linked project {project_id} to region {region_name}")
        else:
            print(f"Failed to get valid response from Gemini API for Project ID: {project_id}")

    print(f"All CSVs generated successfully in {output_dir}.")

if __name__ == "__main__":
    input_file = "source_data/1-2.csv"
    generate_metadata_program(input_file)
