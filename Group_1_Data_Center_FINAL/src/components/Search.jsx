// Search panel component that captures the ZIP code query and submits it.

export default function Search({ searchTerm, setSearchTerm, onSearch, loading }) {
  return (
    <form className="search-panel" onSubmit={onSearch}>
      <label className="visually-hidden" htmlFor="location-search">
        Search ZIP code
      </label>

      <input
        id="location-search"
        className="form-control form-control-lg"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Enter a 5-digit ZIP code, like 30040"
      />

      <button className="btn btn-success btn-lg" type="submit" disabled={loading}>
        {loading ? 'Analyzing…' : 'Analyze'}
      </button>
    </form>
  );
}