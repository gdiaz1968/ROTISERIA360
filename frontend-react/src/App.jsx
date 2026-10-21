
import './App.css'

const modulos = [
  { codigo: 'dashboard', nombre: 'Inicio', icono: '⌂' },
  { codigo: 'productos', nombre: 'Productos', icono: '▦' },
  { codigo: 'proveedores', nombre: 'Proveedores', icono: '♙' },
  { codigo: 'estructura', nombre: 'Estructura de productos', icono: '☷' },
  { codigo: 'costos', nombre: 'Costos', icono: '$' },
  { codigo: 'ventas', nombre: 'Ventas de mostrador', icono: '▤' },
]

function App() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">R360</div>
          <div>
            <strong>ROTISERIA360</strong>
            <span>Sistema de gestión</span>
          </div>
        </div>

        <div className="menu-caption">MENÚ PRINCIPAL</div>

        <nav className="menu">
          {modulos.map((modulo, index) => (
            <button
              key={modulo.codigo}
              className={`menu-item ${index === 0 ? 'selected' : ''}`}
              type="button"
              onClick={() => {
                if (modulo.codigo !== 'dashboard') {
                  alert(`El módulo ${modulo.nombre} se incorporará en React.`)
                }
              }}
            >
              <span className="menu-icon">{modulo.icono}</span>
              <span>{modulo.nombre}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          ROTISERIA360
          <span>Versión de desarrollo</span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Sistema / Inicio</span>
            <h1>Panel de gestión</h1>
          </div>
          <div className="user-info">
            <div className="user-avatar">GD</div>
            <div>
              <strong>Administrador</strong>
              <span>Usuario del sistema</span>
            </div>
          </div>
        </header>

        <section className="content">
          <div className="welcome">
            <div>
              <span className="eyebrow">ROTISERIA360 · REACT</span>
              <h2>Bienvenido al sistema</h2>
              <p>
                Desde aquí vamos a administrar los productos, proveedores,
                costos y las ventas de mostrador.
              </p>
            </div>
            <div className="welcome-mark">360</div>
          </div>

          <div className="section-heading">
            <div>
              <h2>Acceso a módulos</h2>
              <p>Seleccioná el área que querés desarrollar.</p>
            </div>
          </div>

          <div className="module-grid">
            {modulos.slice(1).map((modulo) => (
              <button
                type="button"
                className="module-card"
                key={modulo.codigo}
                onClick={() =>
                  alert(`El módulo ${modulo.nombre} se incorporará en React.`)
                }
              >
                <div className="module-icon">{modulo.icono}</div>
                <strong>{modulo.nombre}</strong>
                <span>Ingresar al módulo <span aria-hidden="true">→</span></span>
              </button>
            ))}
          </div>

          <div className="status-panel">
            <div className="status-dot" />
            <div>
              <strong>Interfaz React iniciada</strong>
              <p>Esta pantalla es independiente del frontend anterior.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
