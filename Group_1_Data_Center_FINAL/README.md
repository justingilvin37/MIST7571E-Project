Data Center Risk Analyzer

## Project Description 
The Data Center Risk Analyzer is a web application that helps users understand the potential environmental impact of data centers in a specific zip code by analyzing environmental factors like weather and precipitation. It solves the problem of making complex environmental data easier to understand by using AI to generate a simple risk score and plain word summary, helping communities and decision-makers make more informed choices.

## Component Hierarchy
Search 
Risk Score 
Environmental Snapshot
Map Panel 
Score Breakdown 
AI Summary 

## API Integrations
Zippopotam.us - ZIP code to city/state and latitude/longitude lookup used for Leaflet map position and City/State name used in Risk Score and OpenAI summary

FCC Census Block API - county lookup used for Leaflet map and OpenAI summary

US Census Bureau API - ZIP code population look up used for OpenAI summary

NOAA/National Weather Service - fetches forecast metadata, tempurature and precipitation values to render the Enviromental Snapshot cards, as well to generate risk score and to be used in AI summary. 

OpenStreetMap tile layer - renders the map tile in the Leaflet map

OpenAI - generate a plain-language community impact summary describing the location, weather context, score meaning, and data center water-use implications


## Environmental Setup
1. Create a new .env file
Copy `.env.example` to `.env`.
2. Add your OpenAI API key to the `.env` file and save
3. Open Terminal
Run the following:
npm install
npm run dev