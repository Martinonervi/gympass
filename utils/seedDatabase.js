import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const ejecutarSeeding = async () => {
    try {
        // 1. Gimnasios mockeados
        const gyms = [
            {
                id: "gym_demo_01",
                nombre: "Iron Forge Palermo",
                descripcion: "Gimnasio de fuerza y acondicionamiento",
                coordenadas: { lat: -34.588, lng: -58.430 }
            },
            {
                id: "gym_demo_02",
                nombre: "SportFlow Belgrano",
                descripcion: "Centro deportivo integral",
                coordenadas: { lat: -34.562, lng: -58.456 }
            },
            {
                id: "gym_demo_03",
                nombre: "Zenith Fitness San Telmo",
                descripcion: "Tu espacio para el bienestar físico y mental",
                coordenadas: { lat: -34.621, lng: -58.373 }
            }
        ];

        for (const gym of gyms) {
            const { id, ...gymData } = gym;
            const gymRef = doc(db, 'gimnasios', id);
            
            // setDoc con ID fijo para no duplicar
            await setDoc(gymRef, {
                ...gymData,
                createdAt: serverTimestamp()
            });

            // 2. Subcolección 'clases'
            const clases = [
                { nombre: "Crossfit", horaInicio: "08:00", horaFin: "09:00", cupos: 20 },
                { nombre: "Spinning", horaInicio: "10:00", horaFin: "11:00", cupos: 15 },
                { nombre: "Yoga", horaInicio: "18:00", horaFin: "19:00", cupos: 25 },
                { nombre: "Funcional", horaInicio: "20:00", horaFin: "21:00", cupos: 30 }
            ];
            
            const clasesRef = collection(gymRef, 'clases');
            for (const clase of clases) {
                await addDoc(clasesRef, {
                    ...clase,
                    createdAt: serverTimestamp()
                });
            }

            // 3. Subcolección 'resenas'
            const resenas = [
                { usuarioNombre: "Juan Perez", comentario: "Excelente lugar, muy completo.", calificacion: 5 },
                { usuarioNombre: "Maria Gomez", comentario: "Buenos profesores, pero faltan algunas máquinas.", calificacion: 4 },
                { usuarioNombre: "Carlos Diaz", comentario: "Me encanta el ambiente.", calificacion: 5 }
            ];

            const resenasRef = collection(gymRef, 'resenas');
            for (const resena of resenas) {
                await addDoc(resenasRef, {
                    ...resena,
                    createdAt: serverTimestamp()
                });
            }
        }

        // 4. Empleador B2B de prueba
        const empleadorId = "empresa_demo_tech";
        const empleadorRef = doc(db, 'empleadores', empleadorId);
        
        await setDoc(empleadorRef, {
            nombreEmpresa: "TechSolutions Argentina",
            planTipo: "Platinum",
            cuposTotales: 30,
            cuposUsados: 2,
            createdAt: serverTimestamp()
        });

        // 5. Subcolección 'nomina' para el empleador
        const nomina = [
            { email: "empleado1@tech.com", estado: "activo" },
            { email: "empleado2@tech.com", estado: "activo" }
        ];

        const nominaRef = collection(empleadorRef, 'nomina');
        for (const empleado of nomina) {
            await addDoc(nominaRef, {
                ...empleado,
                createdAt: serverTimestamp()
            });
        }

        return true;
    } catch (error) {
        console.error("Error ejecutando seeding de base de datos:", error);
        return false;
    }
};
